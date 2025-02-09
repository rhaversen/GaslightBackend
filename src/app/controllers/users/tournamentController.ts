// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose, { type SortOrder } from 'mongoose'

// Own modules
import TournamentModel, { TournamentStanding } from '../../models/Tournament.js'
import logger from '../../utils/logger.js'
import { IGrading } from '../../models/Grading.js'

// Environment variables
// Config variables
// Destructuring and global variables

export async function getAllTournaments(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting tournaments')

	const { getStandings, fromDate, toDate, limit, skip, limitStandings, skipStandings, userIdStanding, sortFieldStandings, sortDirectionStandings } = req.query
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
			let standings: TournamentStanding[] | undefined = undefined
			if (getStandings === 'true') {
				standings = await tournament.getStandings(
					Number(limitStandings) || 3,
					Number(skipStandings) || 0,
					sortFieldStandings as keyof IGrading | undefined || 'score',
					(sortDirectionStandings as SortOrder)
				)
			}

			const shouldGetUserStanding = typeof userIdStanding === 'string' && mongoose.Types.ObjectId.isValid(userIdStanding)

			return {
				_id: tournament.id,
				disqualified: tournament.disqualified,
				submissionCount: tournament.gradings.length,
				tournamentExecutionTime: tournament.tournamentExecutionTime,
				game: tournament.game,
				standings,
				userStanding: shouldGetUserStanding ? await tournament.getStanding(userIdStanding) : null,
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

		const { getStandings, limitStandings, skipStandings, userIdStanding, sortFieldStandings, sortDirectionStandings } = req.query

		let standings: TournamentStanding[] | undefined = undefined
		if (getStandings === 'true') {
			standings = await tournament.getStandings(
				Number(limitStandings) || 30,
				Number(skipStandings) || 0,
				sortFieldStandings as keyof IGrading | undefined || 'score',
				(sortDirectionStandings as SortOrder) || -1
			)
		}

		const shouldGetUserStanding = typeof userIdStanding === 'string' && mongoose.Types.ObjectId.isValid(userIdStanding)

		res.status(200).json({
			_id: tournament.id,
			disqualified: tournament.disqualified,
			submissionCount: tournament.gradings.length,
			tournamentExecutionTime: tournament.tournamentExecutionTime,
			game: tournament.game,
			standings,
			userStanding: shouldGetUserStanding ? await tournament.getStanding(userIdStanding) : null,
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

		const { limitStandings, skipStandings, sortFieldStandings, sortDirectionStandings } = req.query

		const standings = await tournament.getStandings(
			Number(limitStandings) || 30,
			Number(skipStandings) || 0,
			sortFieldStandings as keyof IGrading | undefined || 'score',
			(sortDirectionStandings as SortOrder) || -1
		)

		res.status(200).json(standings)
	} catch (error) {
		next(error)
	}
}
