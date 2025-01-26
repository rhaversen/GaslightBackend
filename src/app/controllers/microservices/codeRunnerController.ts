// Node.js built-in modules

// Third-party libraries
import { Request, Response } from 'express'

// Own modules
import GradingModel from '../../models/Grading.js'
import SubmissionModel from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import logger from '../../utils/logger.js'
import { emitGradingCreated } from '../../webSockets/GradingHandlers.js'

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

export async function createGradings(req: Request, res: Response) {
	const { gradings } = req.body

	if (!Array.isArray(gradings)) {
		return res.status(400).json({ error: 'Gradings must be an array' })
	}

	try {
		const gradingObjects = gradings.map(grading => ({
			submission: grading.submission,
			score: grading.score
		}))

		const newGradings = await GradingModel.insertMany(gradingObjects)
		const gradingIds = newGradings.map(grading => grading._id)
		res.status(201).json(gradingIds)
	} catch (error) {
		logger.error(error)
		res.status(400).json({ error: 'Invalid data' })
	}
}

export async function createTournament(req: Request, res: Response) {
	const allowedFields: Record<string, unknown> = {
		gradings: req.body.gradings
	}

	try {
		const newTournament = await TournamentModel.create(allowedFields)
		res.status(201).json(newTournament)
	} catch (error) {
		logger.error(error)
		res.status(400).json({ error: 'Invalid data' })
	}
}
