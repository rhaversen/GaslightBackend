// Node.js built-in modules

// Third-party libraries
import { Request, Response } from 'express'

// Own modules
import GradingModel from '../../models/Grading.js'
import SubmissionModel from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import logger from '../../utils/logger.js'

// Environment variables

// Config variables

// Destructuring and global variables

export async function getActiveSubmissions(req: Request, res: Response) {
	try {
		const submissions = await SubmissionModel.find({ active: true, passedEvaluation: true }).exec()
		res.status(200).json(submissions)
	} catch (error) {
		logger.error(error)
		res.status(500).json({ error: 'Server error' })
	}
}

export async function saveGradingsWithTournament(req: Request, res: Response) {
	const {
		gradings,
		disqualified,
	 } = req.body

	if (!Array.isArray(gradings)) {
		return res.status(400).json({ error: 'Gradings must be an array' })
	}

	try {
		const newGradings = await GradingModel.insertMany(gradings)
		const gradingIds = newGradings.map(grading => grading._id)

		// Create tournament with the new gradings and disqualified submissions
		const newTournament = await TournamentModel.create({ gradings: gradingIds, disqualified })

		res.status(201).json({
			gradings: gradingIds,
			tournament: newTournament
		})
	} catch (error) {
		logger.error(error)
		res.status(400).json({ error: 'Invalid data' })
	}
}
