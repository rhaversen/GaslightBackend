// Node.js built-in modules

// Third-party libraries
import { Request, Response } from 'express'

// Own modules
import GradingModel, { IGrading } from '../../models/Grading.js'
import SubmissionModel from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import logger from '../../utils/logger.js'
import { submission } from '../../services/CodeRunner.js'
import { emitTournamentCreated } from '../../webSockets/TournamentHandlers.js'

// Environment variables

// Config variables

// Destructuring and global variables

export async function getActiveSubmissions(req: Request, res: Response) {
	const { excludeUser } = req.query

	try {
		// Build dynamic filter object based on query params
		const filter: any = {
			active: true,
			passedEvaluation: true,
		}

		if (excludeUser) {
			filter.user = { $ne: excludeUser } // Exclude the user if provided
		}

		// Fetch submissions based on the dynamic filter
		const submissions = await SubmissionModel.find(filter)

		// Map the submissions to a specific format
		const mappedSubmissions: submission[] = submissions.map(sub => ({
			submissionId: sub.id,
			files: { 'main.ts': sub.code }
		}))
		res.status(200).json(mappedSubmissions)
	} catch (error) {
		logger.error(error)
		res.status(500).json({ error: 'Server error' })
	}
}

type Grading = { submission: string; score: number; avgExecutionTime: number; }
type Disqualification = { submission: string; reason: string; }

export async function processTournamentGradings(gradings: Grading[], disqualified: Disqualification[], tournamentExecutionTime: number) {
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
			...g,
			placement: scoreToPlacement.get(g.score)!,
			tokenCount: submissionMap.get(g.submission)?.getTokenCount(),
			percentileRank: (scoreToCumulative.get(g.score)! / scores.length) * 100,
		})) as IGrading[]

		const newGradings = await GradingModel.insertMany(enrichedGradings)
		const tournament = await TournamentModel.create({
			gradings: newGradings.map(gr => gr._id),
			disqualified,
			tournamentExecutionTime
		})

		emitTournamentCreated(tournament)
		return tournament
	} catch (error) {
		logger.error(error)
		return null
	}
}

export async function saveGradingsWithTournament(req: Request, res: Response) {
	const {
		gradings,
		disqualified,
		tournamentExecutionTime
	} = req.body

	if (!Array.isArray(gradings)) {
		return res.status(400).json({ error: 'Gradings must be an array' })
	}

	const tournament = await processTournamentGradings(gradings, disqualified, tournamentExecutionTime)
	if (tournament === null) {
		res.status(400).json({ error: 'Invalid data' })
	} else {
		res.status(201).json({ tournamentId: tournament._id })
	}
}
