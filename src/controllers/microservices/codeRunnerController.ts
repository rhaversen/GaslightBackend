import { type Request, type Response } from 'express'

import GameModel from '../../models/Game.js'
import GradingModel from '../../models/Grading.js'
import SubmissionModel from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import { type submission } from '../../services/CodeRunner.js'
import logger from '../../utils/logger.js'
import { emitTournamentCreated } from '../../webSockets/TournamentHandlers.js'

export async function getActiveSubmissions (req: Request, res: Response): Promise<void> {
	const { excludeUser, game } = req.query

	try {
		// Build dynamic filter object based on query params
		const filter: Record<string, unknown> = {
			active: true,
			passedEvaluation: true
		}

		if (typeof excludeUser === 'string') {
			filter.user = { $ne: excludeUser } // Exclude the user if provided
		}

		if (typeof game === 'string') {
			filter.game = game // Filter by game if provided
		}

		// Fetch submissions based on the dynamic filter
		const submissions = await SubmissionModel.find(filter as never)

		// Map the submissions to a specific format
		const mappedSubmissions: submission[] = submissions.map(sub => ({
			submissionId: sub.id,
			files: { 'main.ts': sub.code }
		}))
		res.status(200).json(mappedSubmissions)
	} catch (error) {
		logger.error('Failed to fetch submissions', { error })
		res.status(500).json({ error: 'Server error' })
	}
}

export async function getGames (req: Request, res: Response) {
	try {
		const games = await GameModel.find()
		const mappedGames = games.map(game => ({
			id: game.id,
			gameFiles: game.files,
			minPlayers: game.minPlayers,
			maxPlayers: game.maxPlayers
		}))
		res.status(200).json(mappedGames)
	} catch (error) {
		logger.error('Failed to fetch games', { error })
		res.status(500).json({ error: 'Server error' })
	}
}

type Grading = { submission: string; score: number; avgExecutionTime: number; }
type Disqualification = { submission: string; reason: string; }

export async function processTournamentGradings (gradings: Grading[], disqualified: Disqualification[], tournamentExecutionTime: number, game: string) {
	try {
		const disqualifiedSet = new Set(disqualified.map(d => d.submission))
		const validGradings = gradings.filter(g => !disqualifiedSet.has(g.submission))

		const submissions = await SubmissionModel.find({ _id: { $in: validGradings.map(g => g.submission) } }).exec()
		const submissionMap = new Map(submissions.map(s => [s.id, s]))

		const validSubmissionGradings = validGradings.filter(g => submissionMap.has(g.submission))
		const scores = validSubmissionGradings.map(g => g.score)

		const uniqueScoresDesc = [...new Set(scores)].sort((a, b) => b - a)
		const scoreToPlacement = new Map(uniqueScoresDesc.map((score, i) => [score, i + 1]))

		const uniqueScoresAsc = [...uniqueScoresDesc].reverse()
		const frequencyMap = new Map<number, number>()
		scores.forEach(score => frequencyMap.set(score, (frequencyMap.get(score) || 0) + 1))

		let cumulativeCount = 0
		const scoreToCumulative = new Map<number, number>()
		uniqueScoresAsc.forEach(score => {
			cumulativeCount += frequencyMap.get(score)!
			scoreToCumulative.set(score, cumulativeCount)
		})

		const enrichedGradings = validSubmissionGradings.map(g => ({
			submission: g.submission,
			score: g.score,
			avgExecutionTime: g.avgExecutionTime,
			placement: scoreToPlacement.get(g.score) ?? 0,
			tokenCount: submissionMap.get(g.submission)?.tokenCount ?? 0,
			percentileRank: ((scoreToCumulative.get(g.score) ?? 0) / scores.length) * 100
		}))

		const tournament = await TournamentModel.create({
			game,
			disqualified,
			gradingCount: enrichedGradings.length,
			tournamentExecutionTime
		})

		// Gradings are the flat event stream: each carries its dimensions
		// (tournament, game, user) so every lens matches on an index directly.
		await GradingModel.insertMany(enrichedGradings.map(g => ({
			...g,
			tournament: tournament.id,
			game,
			user: submissionMap.get(g.submission)?.user
		})))

		emitTournamentCreated(tournament)
		return tournament
	} catch (error) {
		logger.error('Failed to process tournament gradings', { error })
		return null
	}
}

export async function saveGradingsWithTournament (req: Request, res: Response) {
	const {
		gradings,
		disqualified,
		tournamentExecutionTime,
		game
	} = req.body

	if (!Array.isArray(gradings)) {
		return res.status(400).json({ error: 'Gradings must be an array' })
	}

	const tournament = await processTournamentGradings(gradings, disqualified, tournamentExecutionTime, game)
	if (tournament === null) {
		res.status(400).json({ error: 'Invalid data' })
	} else {
		res.status(201).json({ tournamentId: tournament._id })
	}
}
