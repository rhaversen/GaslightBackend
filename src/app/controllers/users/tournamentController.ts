// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import logger from '../../utils/logger.js'
import TournamentModel from '../../models/Tournament.js'
import GradingModel from '../../models/Grading.js'

// Environment variables
// Config variables
// Destructuring and global variables

export async function getAllTournaments(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting tournaments')

	const { status, fromDate, toDate, type, maxAmount, startIndex } = req.query
	const query: any = {}

	if (fromDate || toDate) {
		query.createdAt = {}
		if (typeof fromDate === 'string') query.createdAt.$gte = new Date(fromDate)
		if (typeof toDate === 'string') query.createdAt.$lte = new Date(toDate)
	}

	if (typeof status === 'string') query.status = { $in: status.split(',') }
	if (typeof type === 'string') query.type = { $in: type.split(',') }

	try {
		const tournaments = await TournamentModel.find(query)
			.limit(Number(maxAmount) || 0)
			.skip(Number(startIndex) || 0)
			.populate({
				path: 'gradings',
				select: 'status score'
			})
			.exec()

		res.status(200).json(tournaments)
	} catch (error) {
		if (error instanceof mongoose.Error.ValidationError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	}
}

export async function getTournament(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting tournament')
	try {
		const tournament = await TournamentModel.findById(req.params.id)
		if (tournament === null) {
			res.status(404).json({ error: 'Tournament not found' })
			return
		}
		res.status(200).json(tournament)
	} catch (error) {
		next(error)
	}
}

export async function getTournamentGradings(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting tournament gradings')
	try {
		const tournament = await TournamentModel.findById(req.params.id)
		if (tournament === null) {
			res.status(404).json({ error: 'Tournament not found' })
			return
		}
		const gradings = await GradingModel.find({
			_id: { $in: tournament.gradings }
		})
		res.status(200).json(gradings)
	} catch (error) {
		next(error)
	}
}
