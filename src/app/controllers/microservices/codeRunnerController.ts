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
		// Create a Set of disqualified IDs for O(1) lookup
		const disqualifiedSet = new Set(disqualified.map(d => d.submission))

		// Filter gradings in a single pass
		const validGradings = gradings.filter(g => !disqualifiedSet.has(g.submission))

		// Get all submissions in one query
		const submissions = await SubmissionModel.find(
			{ _id: { $in: validGradings.map(g => g.submission) } }
		).exec()

		// Create submission map for O(1) lookup
		const submissionMap = new Map(submissions.map(s => [s.id, s]))

		// Filter and prepare scores in a single pass
		const validSubmissionGradings = validGradings.filter(g => submissionMap.has(g.submission))
		const scores = validSubmissionGradings.map(g => g.score)

		// Calculate statistics in a single pass
		let sum = 0
		let sumSquared = 0
		for (const score of scores) {
			sum += score
			sumSquared += score * score
		}
		const count = scores.length
		const mean = sum / count
		const standardDeviation = Math.sqrt((sumSquared / count) - (mean * mean))

		// Create score to placement map
		const scoreToPlacement = new Map([...new Set(scores)]
			.sort((a, b) => b - a)
			.map((score, index) => [score, index + 1])
		)

		// Prepare all gradings in parallel
		const enrichedGradings = validSubmissionGradings.map(grading => ({
			...grading,
			zValue: standardDeviation === 0 ? 0 : (grading.score - mean) / standardDeviation,
			placement: scoreToPlacement.get(grading.score)!,
			tokenCount: submissionMap.get(grading.submission)?.getTokenCount(),
			avgExecutionTime: grading.avgExecutionTime,
		})) as IGrading[]

		const newGradings = await GradingModel.insertMany(enrichedGradings)
		const gradingIds = newGradings.map(grading => grading._id)

		// Create tournament with essential fields only
		const tournament = await TournamentModel.create({
			gradings: gradingIds,
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
