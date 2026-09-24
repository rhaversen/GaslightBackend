import mongoose, { type SortOrder } from 'mongoose'

import GradingModel from '../models/Grading.js'
import TournamentModel from '../models/Tournament.js'
import { type TournamentStatistics , type TournamentStanding } from '../models/Tournament.js'

// Read helpers over the flat grading stream. These are the primitives the
// lens pipelines build on: tournament → standings, tournament → one user's
// standing, tournament → statistics. All matches hit the
// { tournament, placement } index.

export interface StandingsOptions {
	limit?: number
	skip?: number
	sortField?: string
	sortDirection?: SortOrder
}

export async function getTournamentStandings (tournamentId: string, options: StandingsOptions = {}): Promise<TournamentStanding[]> {
	const { limit = 0, skip = 0, sortField = 'placement', sortDirection = 1 } = options

	const gradings = await GradingModel
		.find({ tournament: tournamentId })
		.sort({ [sortField]: sortDirection, submission: 1 })
		.skip(skip)
		.limit(limit)
		.exec()

	// Resolve mutable labels (username, title) in one round trip each; the
	// event document itself only stores immutable ids.
	const userIds = [...new Set(gradings.map(g => g.user))]
	const submissionIds = [...new Set(gradings.map(g => g.submission))]
	const [users, submissions] = await Promise.all([
		mongoose.model('User').find({ _id: { $in: userIds } }).select('username').exec(),
		mongoose.model('Submission').find({ _id: { $in: submissionIds } }).select('title').exec()
	])
	const userNames = new Map(users.map((u: { id: string, username: string }) => [u.id, u.username]))
	const submissionTitles = new Map(submissions.map((s: { id: string, title: string }) => [s.id, s.title]))

	return gradings.map(grading => ({
		user: grading.user,
		userName: userNames.get(grading.user) ?? 'Unknown user',
		submission: grading.submission,
		submissionName: submissionTitles.get(grading.submission) ?? 'Unknown strategy',
		score: grading.score,
		tokenCount: grading.tokenCount,
		placement: grading.placement,
		percentileRank: grading.percentileRank,
		avgExecutionTime: grading.avgExecutionTime
	}))
}

export async function getUserStanding (tournamentId: string, userId: string): Promise<TournamentStanding | null> {
	const standings = await getTournamentStandings(tournamentId, { limit: 0 })
	return standings.find(standing => standing.user === userId) ?? null
}

export async function calculateTournamentStatistics (tournamentId: string): Promise<TournamentStatistics | null> {
	const tournament = await TournamentModel.findById(tournamentId).exec()
	if (tournament === null) { return null }

	const gradings = await GradingModel
		.find({ tournament: tournamentId })
		.select('score')
		.exec()

	const scores = gradings.map(g => g.score).sort((a, b) => a - b)
	const sampleSize = scores.length

	if (sampleSize === 0) {
		return {
			sampleSize: 0,
			centralTendency: { arithmeticMean: 0, harmonicMean: null, mode: [] },
			dispersion: { variance: 0, standardDeviation: 0, interquartileRange: 0 },
			distribution: { skewness: null, kurtosis: null },
			percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
			extrema: { minimum: 0, maximum: 0, range: 0 },
			tukeyCriteria: { lowerBound: 0, upperBound: 0 },
			outlierValues: []
		}
	}

	const arithmeticMean = scores.reduce((a, b) => a + b, 0) / sampleSize

	const nonZero = scores.filter(score => score !== 0)
	const harmonicMean = nonZero.length > 0
		? nonZero.length / nonZero.reduce((a, b) => a + (1 / b), 0)
		: null

	const frequency = new Map<number, number>()
	for (const score of scores) {
		frequency.set(score, (frequency.get(score) ?? 0) + 1)
	}
	const maxFrequency = Math.max(...frequency.values())
	const mode = [...frequency.entries()]
		.filter(([, count]) => count === maxFrequency)
		.map(([score]) => score)

	const variance = scores.reduce((acc, score) => acc + Math.pow(score - arithmeticMean, 2), 0) / (sampleSize - 1)
	const standardDeviation = Math.sqrt(variance)

	// Percentile calculation using linear interpolation
	const getPercentile = (p: number) => {
		const rank = p * (sampleSize - 1)
		const floor = Math.floor(rank)
		const ceil = Math.ceil(rank)
		const floorScore = scores[floor] ?? 0
		if (floor === ceil) { return floorScore }
		const fraction = rank - floor
		return floorScore * (1 - fraction) + (scores[ceil] ?? 0) * fraction
	}

	const percentiles = {
		p10: getPercentile(0.10),
		p25: getPercentile(0.25),
		p50: getPercentile(0.50),
		p75: getPercentile(0.75),
		p90: getPercentile(0.90)
	}

	const interquartileRange = percentiles.p75 - percentiles.p25
	const tukeyCriteria = {
		lowerBound: percentiles.p25 - (1.5 * interquartileRange),
		upperBound: percentiles.p75 + (1.5 * interquartileRange)
	}

	const extrema = {
		minimum: scores[0] ?? 0,
		maximum: scores[sampleSize - 1] ?? 0,
		range: (scores[sampleSize - 1] ?? 0) - (scores[0] ?? 0)
	}

	const outlierValues = scores.filter(score =>
		score < tukeyCriteria.lowerBound ||
		score > tukeyCriteria.upperBound
	)

	// Distribution shape only meaningful with enough samples
	const skewness = sampleSize > 2 && standardDeviation !== 0
		? (sampleSize / ((sampleSize - 1) * (sampleSize - 2))) *
			scores.reduce((acc, score) => acc + Math.pow((score - arithmeticMean) / standardDeviation, 3), 0)
		: null

	const kurtosis = sampleSize > 3 && standardDeviation !== 0
		? ((scores.reduce((acc, score) => acc + Math.pow((score - arithmeticMean) / standardDeviation, 4), 0) * sampleSize * (sampleSize + 1))
			/ ((sampleSize - 1) * (sampleSize - 2) * (sampleSize - 3)))
		- (3 * Math.pow(sampleSize - 1, 2)) / ((sampleSize - 2) * (sampleSize - 3))
		: null

	return {
		sampleSize,
		centralTendency: { arithmeticMean, harmonicMean, mode },
		dispersion: { variance, standardDeviation, interquartileRange },
		distribution: { skewness, kurtosis },
		percentiles,
		extrema,
		tukeyCriteria,
		outlierValues
	}
}

export function isValidObjectId (id: string): boolean {
	return mongoose.Types.ObjectId.isValid(id)
}
