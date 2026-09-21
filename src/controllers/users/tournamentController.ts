import { type Request, type Response } from 'express'
import mongoose, { type SortOrder } from 'mongoose'

import GradingModel from '../../models/Grading.js'
import { type IGrading } from '../../models/Grading.js'
import TournamentModel from '../../models/Tournament.js'
import { type TournamentStanding } from '../../models/Tournament.js'
import { NotFoundError } from '../../utils/errors.js'
import logger from '../../utils/logger.js'

export async function getAllTournaments (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting tournaments')

	const { getStandings, includesUser, game, fromDate, toDate, limit, skip, limitStandings, skipStandings, userIdStanding, sortFieldStandings, sortDirectionStandings } = req.query
	interface TournamentQuery {
		game?: string
		gradings?: { $in: string[] }
		createdAt?: { $gte?: Date, $lte?: Date }
	}

	const query: TournamentQuery = {}

	if (fromDate !== undefined || toDate !== undefined) {
		query.createdAt = {}
		if (typeof fromDate === 'string') { query.createdAt.$gte = new Date(fromDate) }
		if (typeof toDate === 'string') { query.createdAt.$lte = new Date(toDate) }
	}

	if (typeof game === 'string') {
		query.game = game
	}

	if (typeof includesUser === 'string') {
		const gradingDocs = await GradingModel.find()
			.populate({ path: 'submission', select: 'user', match: { user: new mongoose.Types.ObjectId(includesUser) } })
			.select('_id')
			.exec()
		const filteredGradingIds = gradingDocs.filter(g => g.submission).map(g => g.id)
		query.gradings = { $in: filteredGradingIds }
	}

	const tournaments = await TournamentModel.find(query)
		.sort({ createdAt: -1 })
		.limit(Number(limit) || 0)
		.skip(Number(skip) || 0)
		.exec()

	if (tournaments.length === 0) {
		res.status(200).json([])
		return
	}

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
}

export async function getTournament (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting tournament')
	const tournament = await TournamentModel.findById(req.params.id)
	if (tournament === null) {
		throw new NotFoundError('Tournament not found')
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
}

export async function getTournamentStatistics (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting tournament statistics')
	const tournament = await TournamentModel.findById(req.params.id)
	if (tournament === null) {
		throw new NotFoundError('Tournament not found')
	}

	const statistics = await tournament.calculateStatistics()

	res.status(200).json(statistics)
}

export async function getTournamentStandings (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting tournament standings')
	const tournament = await TournamentModel.findById(req.params.id)
	if (tournament === null) {
		throw new NotFoundError('Tournament not found')
	}

	const { limitStandings, skipStandings, sortFieldStandings, sortDirectionStandings } = req.query

	const standings = await tournament.getStandings(
		Number(limitStandings) || 30,
		Number(skipStandings) || 0,
		sortFieldStandings as keyof IGrading | undefined || 'score',
		(sortDirectionStandings as SortOrder) || -1
	)

	res.status(200).json(standings)
}
