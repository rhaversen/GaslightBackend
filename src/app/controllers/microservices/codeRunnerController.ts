// Node.js built-in modules

// Third-party libraries
import { Request, Response } from 'express'

// Own modules
import GradingModel, { IGrading } from '../../models/Grading.js'
import SubmissionModel from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import logger from '../../utils/logger.js'
import { submission } from '../../services/CodeRunner.js'

// Environment variables

// Config variables

// Destructuring and global variables

export async function getActiveSubmissions(req: Request, res: Response) {
	try {
		const submissions = await SubmissionModel.find({ active: true, passedEvaluation: true }).exec()
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

export async function saveGradingsWithTournament(req: Request, res: Response) {
	const {
		gradings,
		disqualified,
		tournamentExecutionTime
	} = req.body

	if (!Array.isArray(gradings)) {
		return res.status(400).json({ error: 'Gradings must be an array' })
	}

	try {
		// Calculate z-values for all gradings at once
		const scores = gradings.map(g => g.score)
		const mean = scores.reduce((a, b) => a + b, 0) / scores.length
		const standardDeviation = Math.sqrt(
			scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
		)

		// Calculate placement for grading
		const sortedScores = scores.sort((a, b) => b - a)
		const placement = gradings.map(g => sortedScores.indexOf(g.score) + 1)

		const enrichedGradings = gradings.map(grading => ({
			...grading,
			zValue: standardDeviation === 0 ? 0 : (grading.score - mean) / standardDeviation,
			placement: placement[gradings.indexOf(grading)]
		})) as IGrading[]

		const newGradings = await GradingModel.insertMany(enrichedGradings)
		const gradingIds = newGradings.map(grading => grading._id)

		// Create tournament with essential fields only
		const tournament = await TournamentModel.create({
			gradings: gradingIds,
			disqualified,
			tournamentExecutionTime
		})

		res.status(201).json({ tournamentId: tournament._id })
	} catch (error) {
		logger.error(error)
		res.status(400).json({ error: 'Invalid data' })
	}
}
