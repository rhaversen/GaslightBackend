import { type Request, type Response } from 'express'

import GradingModel from '../../models/Grading.js'
import TournamentModel from '../../models/Tournament.js'
import {
	calculateTournamentStatistics as calculateStatistics,
	getTournamentStandings as fetchTournamentStandings,
	getUserStanding as fetchUserStanding,
	isValidObjectId,
	type StandingsOptions
} from '../../services/standings.js'
import { NotFoundError } from '../../utils/errors.js'
import logger from '../../utils/logger.js'

function standingsOptions (req: Request, defaults: { limit: number }): StandingsOptions {
	const { limitStandings, skipStandings, sortFieldStandings, sortDirectionStandings } = req.query
	return {
		limit: Number(limitStandings) || defaults.limit,
		skip: Number(skipStandings) || 0,
		sortField: typeof sortFieldStandings === 'string' ? sortFieldStandings : 'placement',
		sortDirection: sortDirectionStandings === '1' ? 1 : -1
	}
}

/**
 * The daily tournament is scheduled at UTC midnight. Everything about
 * "today's tournament" — the countdown target, whether it is currently
 * running — derives from this boundary.
 */
export function utcMidnight (date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export async function getTournamentStatus (
	_req: Request,
	res: Response
): Promise<void> {
	const now = new Date()
	const dayStart = utcMidnight(now)
	const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

	// A tournament "today" is one that ran since this UTC midnight. Its absence
	// means the daily batch has not fired yet — the countdown is to midnight,
	// and the flag stays false no matter how far past midnight local time is.
	const todaysTournament = await TournamentModel
		.findOne({ createdAt: { $gte: dayStart, $lt: nextDayStart } })
		.sort({ createdAt: -1 })
		.select('_id createdAt')
		.exec()

	res.status(200).json({
		tournamentInProgress: todaysTournament !== null,
		latestTournamentId: todaysTournament !== null ? todaysTournament.id : null,
		latestTournamentStartedAt: todaysTournament !== null ? todaysTournament.createdAt : null,
		nextTournamentAt: nextDayStart.toISOString(),
		now: now.toISOString()
	})
}

export async function getAllTournaments (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting tournaments')

	const { includesUser, game, fromDate, toDate, limit, skip, getStandings, userIdStanding } = req.query

	const query: Record<string, unknown> = {}

	if (fromDate !== undefined || toDate !== undefined) {
		query.createdAt = {}
		if (typeof fromDate === 'string') { (query.createdAt as Record<string, Date>).$gte = new Date(fromDate) }
		if (typeof toDate === 'string') { (query.createdAt as Record<string, Date>).$lte = new Date(toDate) }
	}

	if (typeof game === 'string') {
		query.game = game
	}

	if (typeof includesUser === 'string' && isValidObjectId(includesUser)) {
		// Tournaments the user's gradings appear in — a direct indexed match
		// on the flat grading stream, replacing the old array-$in traversal.
		const gradings = await GradingModel.find({ user: includesUser }).select('tournament').exec()
		query._id = { $in: gradings.map(g => g.tournament) }
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
		const standings = getStandings === 'true'
			? await fetchTournamentStandings(tournament.id, standingsOptions(req, { limit: 3 }))
			: undefined

		const userStandingId = typeof userIdStanding === 'string' && isValidObjectId(userIdStanding) ? userIdStanding : null

		return {
			_id: tournament.id,
			disqualified: tournament.disqualified,
			submissionCount: tournament.gradingCount,
			tournamentExecutionTime: tournament.tournamentExecutionTime,
			game: tournament.game,
			standings,
			userStanding: userStandingId !== null ? await fetchUserStanding(tournament.id, userStandingId) : null,
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
	const tournament = await TournamentModel.findById(String(req.params.id))
	if (tournament === null) {
		throw new NotFoundError('Tournament not found')
	}

	const { getStandings, userIdStanding } = req.query

	const standings = getStandings === 'true'
		? await fetchTournamentStandings(tournament.id, standingsOptions(req, { limit: 30 }))
		: undefined

	const userIdStandingId = typeof userIdStanding === 'string' && isValidObjectId(userIdStanding) ? userIdStanding : null

	res.status(200).json({
		_id: tournament.id,
		disqualified: tournament.disqualified,
		submissionCount: tournament.gradingCount,
		tournamentExecutionTime: tournament.tournamentExecutionTime,
		game: tournament.game,
		standings,
		userStanding: userIdStandingId !== null ? await fetchUserStanding(tournament.id, userIdStandingId) : null,
		createdAt: tournament.createdAt,
		updatedAt: tournament.updatedAt
	})
}

export async function getTournamentStatistics (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting tournament statistics')
	const statistics = await calculateStatistics(String(req.params.id))
	if (statistics === null) {
		throw new NotFoundError('Tournament not found')
	}

	res.status(200).json(statistics)
}

export async function getTournamentStandings (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting tournament standings')
	const tournament = await TournamentModel.findById(String(req.params.id))
	if (tournament === null) {
		throw new NotFoundError('Tournament not found')
	}

	const standings = await fetchTournamentStandings(tournament.id, standingsOptions(req, { limit: 30 }))

	res.status(200).json(standings)
}
