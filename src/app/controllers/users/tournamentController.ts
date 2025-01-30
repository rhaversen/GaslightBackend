// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import GradingModel from '../../models/Grading.js'
import TournamentModel from '../../models/Tournament.js'
import logger from '../../utils/logger.js'

// Environment variables
// Config variables
// Destructuring and global variables

export async function getAllTournaments(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting tournaments')

	const { fromDate, toDate, limit, skip, limitStandings } = req.query
	const query: any = {}

	if (fromDate || toDate) {
		query.createdAt = {}
		if (typeof fromDate === 'string') query.createdAt.$gte = new Date(fromDate)
		if (typeof toDate === 'string') query.createdAt.$lte = new Date(toDate)
	}

	try {
		const tournaments = await TournamentModel.find(query)
			.sort({ createdAt: -1 })
			.limit(Number(limit) || 0)
			.skip(Number(skip) || 0)
			.exec()

		const enrichedTournaments = await Promise.all(tournaments.map(async tournament => {
			const standings = await tournament.getStandings(Number(limitStandings) || 3)
			return {
				_id: tournament.id,
				gradings: tournament.gradings,
				disqualified: tournament.disqualified,
				tournamentExecutionTime: tournament.tournamentExecutionTime,
				standings,
				createdAt: tournament.createdAt,
				updatedAt: tournament.updatedAt
			}
		}))

		res.status(200).json(enrichedTournaments)
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

		const standings = await tournament.getStandings()

		res.status(200).json({
			_id: tournament.id,
			gradings: tournament.gradings,
			disqualified: tournament.disqualified,
			tournamentExecutionTime: tournament.tournamentExecutionTime,
			standings,
			createdAt: tournament.createdAt,
			updatedAt: tournament.updatedAt
		})
	} catch (error) {
		next(error)
	}
}

export async function getTournamentStatistics(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting tournament statistics')
	try {
		const tournament = await TournamentModel.findById(req.params.id)
		if (tournament === null) {
			res.status(404).json({ error: 'Tournament not found' })
			return
		}

		const statistics = await tournament.calculateStatistics()

		res.status(200).json(statistics)
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

export async function getTournamentStandings(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting tournament standings')
	try {
		const tournament = await TournamentModel.findById(req.params.id)
		if (tournament === null) {
			res.status(404).json({ error: 'Tournament not found' })
			return
		}

		const amount = Number(req.query.amount) || 3
		const standings = await tournament.getStandings(amount)

		res.status(200).json(standings)
	} catch (error) {
		next(error)
	}
}
