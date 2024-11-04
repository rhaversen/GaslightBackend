// Node.js built-in modules

// Third-party libraries
import { Request, Response } from 'express'

// Own modules
import SubmissionModel from '../../models/Submission'
import GradingModel from '../../models/Grading'
import TournamentModel from '../../models/Tournament'
import logger from '../../utils/logger'

// Environment variables

// Config variables

// Destructuring and global variables

export async function getActiveSubmissions(req: Request, res: Response) {
	try {
		const submissions = await SubmissionModel.find({ active: true })
		res.status(200).json(submissions)
	} catch (error) {
		logger.error(error)
		res.status(500).json({ error: 'Server error' })
	}
}

export async function createGrading(req: Request, res: Response) {
	const allowedFields: Record<string, unknown> = {
		submission: req.body.submission,
		score: req.body.score
	}

	try {
		const newGrading = await GradingModel.create(allowedFields)
		res.status(201).json(newGrading)
	} catch (error) {
		logger.error(error)
		res.status(400).json({ error: 'Invalid data' })
	}
}

export async function createGradings(req: Request, res: Response) {
	const allowedFields: Record<string, unknown> = {
		gradings: req.body.gradings
	}

	try {
		const newGradings = await GradingModel.insertMany(allowedFields)
		res.status(201).json(newGradings)
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
