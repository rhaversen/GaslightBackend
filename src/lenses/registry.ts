import mongoose from 'mongoose'

import GameModel from '../models/Game.js'
import GradingModel from '../models/Grading.js'
import SubmissionModel from '../models/Submission.js'
import TournamentModel from '../models/Tournament.js'
import UserModel from '../models/User.js'
import { getTournamentStandings } from '../services/standings.js'

import { type LensDefinition } from './types.js'

// The lens registry - the single source of truth for the explore UI. The
// frontend renders generically from `display` chips and `pivots`; it never
// knows lens specifics. All pipelines resolve labels server-side: the client
// never sees an id it cannot click.

const userNameMap = async (ids: string[]): Promise<Map<string, string>> => {
	const users = await mongoose.model('User').find({ _id: { $in: ids } }).select('username').exec()
	return new Map(users.map((u: { id: string, username: string }) => [u.id, u.username]))
}

const gameNameMap = async (ids: string[]): Promise<Map<string, string>> => {
	const games = await mongoose.model('Game').find({ _id: { $in: ids } }).select('name').exec()
	return new Map(games.map((g: { id: string, name: string }) => [g.id, g.name]))
}

const submissionTitleMap = async (ids: string[]): Promise<Map<string, string>> => {
	const submissions = await mongoose.model('Submission').find({ _id: { $in: ids } }).select('title').exec()
	return new Map(submissions.map((s: { id: string, title: string }) => [s.id, s.title]))
}

/* ---------------------------------- game --------------------------------- */

const browseGame: LensDefinition = {
	id: 'browse',
	from: 'game',
	onto: 'row',
	scopes: 'collection',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'All games, newest first',
	display: ['players', 'strategyCount'],
	pivots: [{ field: 'authorId', labelField: 'authorName', collection: 'user', text: 'Author' }],
	pipeline: async ({ params }) => {
		const filter = params.q !== undefined && params.q.length > 0
			? { name: { $regex: params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
			: {}
		const games = await GameModel
			.find(filter)
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await GameModel.countDocuments(filter)
		const strategyCounts = await SubmissionModel.aggregate<{ _id: string, count: number }>([
			{ $group: { _id: '$game', count: { $sum: 1 } } }
		])
		const counts = new Map(strategyCounts.map(c => [c._id, c.count]))
		const authorNames = await userNameMap(games.map(g => g.user))
		return {
			total,
			rows: games.map(game => ({
				date: game.createdAt,
				id: game.id,
				label: game.name,
				summary: game.summary,
				players: `${game.minPlayers}-${game.maxPlayers}`,
				strategyCount: counts.get(game.id) ?? 0,
				authorId: game.user,
				authorName: authorNames.get(game.user) ?? 'Unknown'
			}))
		}
	}
}

const gameTournaments: LensDefinition = {
	id: 'tournaments',
	from: 'game',
	onto: 'tournament',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'Tournaments this game held',
	display: ['participants'],
	pivots: [{ field: 'winnerId', labelField: 'winnerName', collection: 'user', text: 'Winner' }],
	pipeline: async ({ id, params }) => {
		const game = await GameModel.findById(id)
		if (game === null) { return { rows: [], total: 0 } }
		const tournaments = await TournamentModel
			.find({ game: id })
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await TournamentModel.countDocuments({ game: id })
		// Resolve the winner of each tournament (placement 1) in one aggregate.
		// Group by tournament - the grading's own _id is not the key here.
		const winners = await GradingModel.aggregate<{ _id: string, user: string }>([
			{ $match: { tournament: { $in: tournaments.map(t => t.id) }, placement: 1 } },
			{ $group: { _id: '$tournament', user: { $first: '$user' } } }
		])
		const winnerByTournament = new Map(winners.map(w => [w._id, w.user]))
		const winnerNames = await userNameMap([...winnerByTournament.values()])
		return {
			total,
			focus: { label: game.name, subtitle: `${total} tournaments` },
			rows: tournaments.map(tournament => {
				const winnerId = winnerByTournament.get(tournament.id)
				return {
					date: tournament.createdAt,
					id: tournament.id,
					label: `Tournament - ${tournament.createdAt.toLocaleDateString()}`,
					participants: tournament.gradingCount,
					winnerId,
					winnerName: winnerId !== undefined ? winnerNames.get(winnerId) ?? 'Unknown' : undefined
				}
			})
		}
	}
}

const gameStrategies: LensDefinition = {
	id: 'strategies',
	from: 'game',
	onto: 'strategy',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'Strategies built for this game',
	display: ['active', 'bestPlacement'],
	pivots: [{ field: 'userId', labelField: 'userName', collection: 'user', text: 'Player' }],
	pipeline: async ({ id, params }) => {
		const game = await GameModel.findById(id)
		if (game === null) { return { rows: [], total: 0 } }
		const submissions = await SubmissionModel
			.find({ game: id })
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await SubmissionModel.countDocuments({ game: id })
		const bestPlacements = await GradingModel.aggregate<{ _id: string, best: number }>([
			{ $match: { game: id } },
			{ $group: { _id: '$submission', best: { $min: '$placement' } } }
		])
		const bestBySubmission = new Map(bestPlacements.map(b => [b._id, b.best]))
		const userNames = await userNameMap(submissions.map(s => s.user))
		return {
			total,
			focus: { label: game.name, subtitle: `${total} strategies` },
			rows: submissions.map(submission => ({
				date: submission.createdAt,
				id: submission.id,
				label: submission.title,
				active: submission.active,
				bestPlacement: bestBySubmission.get(submission.id),
				userId: submission.user,
				userName: userNames.get(submission.user) ?? 'Unknown'
			}))
		}
	}
}

/* ---------------------------------- user --------------------------------- */

const browseUser: LensDefinition = {
	id: 'browse',
	from: 'user',
	onto: 'row',
	scopes: 'collection',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'All users, newest first',
	display: ['gamesPlayed'],
	pivots: [],
	pipeline: async ({ params }) => {
		const filter = params.q !== undefined && params.q.length > 0
			? { username: { $regex: params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
			: {}
		const users = await UserModel
			.find(filter)
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await UserModel.countDocuments(filter)
		const played = await GradingModel.aggregate<{ _id: string, games: string[] }>([
			{ $group: { _id: '$user', games: { $addToSet: '$game' } } }
		])
		const gameCounts = new Map(played.map(p => [p._id, p.games.length]))
		return {
			total,
			rows: users.map(user => ({
				date: user.createdAt,
				id: user.id,
				label: user.username,
				gamesPlayed: gameCounts.get(user.id) ?? 0
			}))
		}
	}
}

const userGamesCreated: LensDefinition = {
	id: 'games-created',
	from: 'user',
	onto: 'game',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'Games this user made',
	display: ['players', 'strategyCount'],
	pivots: [],
	pipeline: async ({ id, params }) => {
		const user = await UserModel.findById(id)
		if (user === null) { return { rows: [], total: 0 } }
		const games = await GameModel
			.find({ user: id })
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await GameModel.countDocuments({ user: id })
		const strategyCounts = await SubmissionModel.aggregate<{ _id: string, count: number }>([
			{ $match: { game: { $in: games.map(g => g.id) } } },
			{ $group: { _id: '$game', count: { $sum: 1 } } }
		])
		const counts = new Map(strategyCounts.map(c => [c._id, c.count]))
		return {
			total,
			focus: { label: user.username, subtitle: 'created games' },
			rows: games.map(game => ({
				date: game.createdAt,
				id: game.id,
				label: game.name,
				summary: game.summary,
				players: `${game.minPlayers}-${game.maxPlayers}`,
				strategyCount: counts.get(game.id) ?? 0
			}))
		}
	}
}

const userGamesPlayed: LensDefinition = {
	id: 'games-played',
	from: 'user',
	onto: 'game',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'Games this user competes in',
	display: ['tournaments', 'bestPlacement'],
	pivots: [],
	pipeline: async ({ id, params }) => {
		const user = await UserModel.findById(id)
		if (user === null) { return { rows: [], total: 0 } }
		const perGame = await GradingModel.aggregate<{ _id: string, tournaments: number, best: number, last: Date }>([
			{ $match: { user: id } },
			{ $group: { _id: '$game', tournaments: { $sum: 1 }, best: { $min: '$placement' }, last: { $max: '$createdAt' } } },
			{ $sort: { last: -1 } },
			{ $skip: params.skip },
			{ $limit: params.limit }
		])
		const totalAgg = await GradingModel.aggregate<{ _id: string, total: number }>([
			{ $match: { user: id } },
			{ $group: { _id: '$game' } },
			{ $group: { _id: null, total: { $sum: 1 } } }
		])
		const total = totalAgg[0]?.total ?? 0
		const gameNames = await gameNameMap(perGame.map(p => p._id))
		return {
			total,
			focus: { label: user.username, subtitle: 'games played' },
			rows: perGame.map(game => ({
				date: game.last,
				id: game._id,
				label: gameNames.get(game._id) ?? 'Unknown game',
				tournaments: game.tournaments,
				bestPlacement: game.best
			}))
		}
	}
}

const userStrategies: LensDefinition = {
	id: 'strategies',
	from: 'user',
	onto: 'strategy',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'Strategies this user built',
	display: ['active', 'tournaments', 'bestPlacement'],
	pivots: [{ field: 'gameId', labelField: 'gameName', collection: 'game', text: 'Game' }],
	pipeline: async ({ id, params }) => {
		const user = await UserModel.findById(id)
		if (user === null) { return { rows: [], total: 0 } }
		const submissions = await SubmissionModel
			.find({ user: id })
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await SubmissionModel.countDocuments({ user: id })
		const stats = await GradingModel.aggregate<{ _id: string, tournaments: number, best: number }>([
			{ $match: { user: id } },
			{ $group: { _id: '$submission', tournaments: { $sum: 1 }, best: { $min: '$placement' } } }
		])
		const statsBySubmission = new Map(stats.map(s => [s._id, s]))
		const gameNames = await gameNameMap(submissions.map(s => s.game))
		return {
			total,
			focus: { label: user.username, subtitle: 'strategies' },
			rows: submissions.map(submission => {
				const stat = statsBySubmission.get(submission.id)
				return {
					date: submission.createdAt,
					id: submission.id,
					label: submission.title,
					active: submission.active,
					tournaments: stat?.tournaments ?? 0,
					bestPlacement: stat?.best,
					gameId: submission.game,
					gameName: gameNames.get(submission.game) ?? 'Unknown'
				}
			})
		}
	}
}

/* -------------------------------- strategy ------------------------------- */

const strategyHistory: LensDefinition = {
	id: 'history',
	from: 'strategy',
	onto: 'tournament',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'Every tournament this strategy entered',
	display: ['placement', 'score', 'percentileRank'],
	pivots: [{ field: 'gameId', labelField: 'gameName', collection: 'game', text: 'Game' }],
	pipeline: async ({ id, params }) => {
		const submission = await SubmissionModel.findById(id)
		if (submission === null) { return { rows: [], total: 0 } }
		const gradings = await GradingModel
			.find({ submission: id })
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await GradingModel.countDocuments({ submission: id })
		const gameNames = await gameNameMap([submission.game])
		return {
			total,
			focus: { label: submission.title, subtitle: `${total} tournaments entered` },
			rows: gradings.map(grading => ({
				date: grading.createdAt,
				id: grading.tournament,
				label: `Tournament - ${grading.createdAt.toLocaleDateString()}`,
				placement: grading.placement,
				score: grading.score,
				percentileRank: grading.percentileRank,
				gameId: submission.game,
				gameName: gameNames.get(submission.game) ?? 'Unknown'
			}))
		}
	}
}

/* ------------------------------- tournament ------------------------------ */

const tournamentParticipants: LensDefinition = {
	id: 'participants',
	from: 'tournament',
	onto: 'user',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 500,
	renderer: 'table',
	description: 'Standings of this tournament',
	display: ['placement', 'score', 'percentileRank', 'tokenCount'],
	pivots: [{ field: 'strategyId', labelField: 'strategyName', collection: 'strategy', text: 'Strategy' }],
	pipeline: async ({ id, params }) => {
		const tournament = await TournamentModel.findById(id)
		if (tournament === null) { return { rows: [], total: 0 } }
		const standings = await getTournamentStandings(id ?? '', { limit: params.limit, skip: params.skip })
		const gameNames = await gameNameMap([tournament.game])
		return {
			total: tournament.gradingCount,
			focus: {
				label: `Tournament - ${tournament.createdAt.toLocaleDateString()}`,
				subtitle: `${tournament.gradingCount} participants`
			},
			rows: standings.map(standing => ({
				date: tournament.createdAt,
				id: standing.user,
				label: standing.userName,
				placement: standing.placement,
				score: standing.score,
				percentileRank: standing.percentileRank,
				tokenCount: standing.tokenCount,
				strategyId: standing.submission,
				strategyName: standing.submissionName,
				gameId: tournament.game,
				gameName: gameNames.get(tournament.game) ?? 'Unknown'
			}))
		}
	}
}

/* ===================== v1.5: sorts, temporal, derived ==================== */

// Tournament browse - all tournaments across games, newest first (rail + meta)
const browseTournament: LensDefinition = {
	id: 'browse',
	from: 'tournament',
	onto: 'tournament',
	scopes: 'collection',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'All tournaments, newest first',
	display: ['participants'],
	pivots: [{ field: 'gameId', labelField: 'gameName', collection: 'game', text: 'Game' }],
	pipeline: async ({ params }) => {
		const filter = params.q !== undefined && params.q.length > 0
			? { game: { $in: (await GameModel.find({ name: { $regex: params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }).select('_id').exec()).map(g => g.id) } }
			: {}
		const tournaments = await TournamentModel
			.find(filter)
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await TournamentModel.countDocuments(filter)
		const gameNames = await gameNameMap(tournaments.map(t => t.game))
		return {
			total,
			rows: tournaments.map(tournament => ({
				date: tournament.createdAt,
				id: tournament.id,
				label: `Tournament - ${tournament.createdAt.toLocaleDateString()}`,
				participants: tournament.gradingCount,
				gameId: tournament.game,
				gameName: gameNames.get(tournament.game) ?? 'Unknown'
			}))
		}
	}
}

// Strategy browse - all strategies, newest first (rail + meta)
const browseStrategy: LensDefinition = {
	id: 'browse',
	from: 'strategy',
	onto: 'strategy',
	scopes: 'collection',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'list',
	description: 'All strategies, newest first',
	display: ['active', 'tournaments', 'bestPlacement'],
	pivots: [
		{ field: 'userId', labelField: 'userName', collection: 'user', text: 'Player' },
		{ field: 'gameId', labelField: 'gameName', collection: 'game', text: 'Game' }
	],
	pipeline: async ({ params }) => {
		const filter = params.q !== undefined && params.q.length > 0
			? { title: { $regex: params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
			: {}
		const submissions = await SubmissionModel
			.find(filter)
			.sort({ createdAt: -1 })
			.skip(params.skip)
			.limit(params.limit)
			.select('title user game active createdAt')
			.exec()
		const total = await SubmissionModel.countDocuments(filter)
		const stats = await GradingModel.aggregate<{ _id: string, tournaments: number, best: number }>([
			{ $match: { submission: { $in: submissions.map(s => s.id) } } },
			{ $group: { _id: '$submission', tournaments: { $sum: 1 }, best: { $min: '$placement' } } }
		])
		const statsBySubmission = new Map(stats.map(s => [s._id, s]))
		const [userNames, gameNames] = await Promise.all([
			userNameMap(submissions.map(s => s.user)),
			gameNameMap(submissions.map(s => s.game))
		])
		return {
			total,
			rows: submissions.map(submission => {
				const stat = statsBySubmission.get(submission.id)
				return {
					date: submission.createdAt,
					id: submission.id,
					label: submission.title,
					active: submission.active,
					tournaments: stat?.tournaments ?? 0,
					bestPlacement: stat?.best,
					userId: submission.user,
					userName: userNames.get(submission.user) ?? 'Unknown',
					gameId: submission.game,
					gameName: gameNames.get(submission.game) ?? 'Unknown'
				}
			})
		}
	}
}

// Sort helpers for collection browse lenses. `params.sort` carries a metric
// name; the pipeline computes the metric per row and sorts in memory (the
// datasets are small enough that this is safe, and each metric is already
// computed per row for display).
function applySort (rows: Array<{ [k: string]: unknown }>, params: { sort?: string, dir?: 'asc' | 'desc' }): void {
	if (params.sort === undefined || params.sort.length === 0) { return }
	const dir = params.dir === 'asc' ? 1 : -1
	rows.sort((a, b) => {
		const av = a[params.sort as string]
		const bv = b[params.sort as string]
		if (typeof av === 'number' && typeof bv === 'number') { return (av - bv) * dir }
		return String(av ?? '').localeCompare(String(bv ?? '')) * dir
	})
}

const leaderboardUser: LensDefinition = {
	id: 'leaderboard',
	from: 'user',
	onto: 'row',
	scopes: 'collection',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 200,
	renderer: 'table',
	description: 'Users ranked by a metric (tournaments, wins, games)',
	display: ['tournaments', 'wins', 'gamesPlayed', 'bestPlacement'],
	pivots: [],
	pipeline: async ({ params }) => {
		const window: Record<string, Date> = {}
		if (params.from !== undefined) { window.$gte = params.from }
		if (params.to !== undefined) { window.$lte = params.to }
		const match = Object.keys(window).length > 0 ? { createdAt: window } : {}

		const stats = await GradingModel.aggregate<{ _id: string, tournaments: number, wins: number, gamesPlayed: number, best: number }>([
			{ $match: match },
			{ $group: { _id: '$user', tournaments: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$placement', 1] }, 1, 0] } }, games: { $addToSet: '$game' }, best: { $min: '$placement' } } },
			{ $project: { tournaments: 1, wins: 1, gamesPlayed: { $size: '$games' }, best: 1 } },
			{ $sort: { tournaments: -1 } },
			{ $limit: params.limit + params.skip }
		])
		const names = await userNameMap(stats.map(s => s._id))
		const rows = stats
			.slice(params.skip)
			.map(s => ({
				id: s._id,
				label: names.get(s._id) ?? 'Unknown',
				tournaments: s.tournaments,
				wins: s.wins,
				gamesPlayed: s.gamesPlayed,
				bestPlacement: s.best
			}))
		applySort(rows, params)
		return { rows, total: stats.length }
	}
}

const leaderboardGame: LensDefinition = {
	id: 'leaderboard',
	from: 'game',
	onto: 'row',
	scopes: 'collection',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 200,
	renderer: 'table',
	description: 'Games ranked by a metric (tournaments, strategies, players)',
	display: ['tournaments', 'strategies', 'players'],
	pivots: [{ field: 'authorId', labelField: 'authorName', collection: 'user', text: 'Author' }],
	pipeline: async ({ params }) => {
		const window: Record<string, Date> = {}
		if (params.from !== undefined) { window.$gte = params.from }
		if (params.to !== undefined) { window.$lte = params.to }
		const match = Object.keys(window).length > 0 ? { createdAt: window } : {}

		const tournamentStats = await GradingModel.aggregate<{ _id: string, tournaments: number, players: number }>([
			{ $match: match },
			{ $group: { _id: '$game', tournaments: { $addToSet: '$tournament' } } },
			{ $project: { tournaments: { $size: '$tournaments' } } }
		])
		const strategyStats = await SubmissionModel.aggregate<{ _id: string, strategies: number }>([
			{ $group: { _id: '$game', strategies: { $sum: 1 } } }
		])
		const tMap = new Map(tournamentStats.map(t => [t._id, t.tournaments]))
		const sMap = new Map(strategyStats.map(s => [s._id, s.strategies]))
		const games = await GameModel.find().exec()
		const authorNames = await userNameMap(games.map(g => g.user))
		const rows = games.map(game => ({
			date: game.createdAt,
			id: game.id,
			label: game.name,
			tournaments: tMap.get(game.id) ?? 0,
			strategies: sMap.get(game.id) ?? 0,
			players: tMap.get(game.id) ?? 0,
			authorId: game.user,
			authorName: authorNames.get(game.user) ?? 'Unknown'
		})).sort((a, b) => (b.tournaments + b.strategies) - (a.tournaments + a.strategies)).slice(params.skip, params.skip + params.limit)
		applySort(rows, params)
		return { rows, total: games.length }
	}
}

// Game tournaments with as-of rewind: filter the window server-side so the
// list can show "tournaments up to date X" (story 22's primitive).
const gameTimeline: LensDefinition = {
	id: 'timeline',
	from: 'game',
	onto: 'tournament',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'timeline',
	description: 'This game over time: tournament participants',
	display: ['participants', 'winnerScore'],
	pivots: [{ field: 'winnerId', labelField: 'winnerName', collection: 'user', text: 'Winner' }],
	pipeline: async ({ id, params }) => {
		const game = await GameModel.findById(id)
		if (game === null) { return { rows: [], total: 0 } }
		const match: Record<string, unknown> = { game: id }
		const window: Record<string, Date> = {}
		if (params.from !== undefined) { window.$gte = params.from }
		if (params.to !== undefined) { window.$lte = params.to }
		if (Object.keys(window).length > 0) { match.createdAt = window }
		const tournaments = await TournamentModel
			.find(match)
			.sort({ createdAt: 1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await TournamentModel.countDocuments(match)
		const winners = await GradingModel.aggregate<{ _id: string, user: string, score: number }>([
			{ $match: { tournament: { $in: tournaments.map(t => t.id) }, placement: 1 } },
			{ $group: { _id: '$tournament', user: { $first: '$user' }, score: { $first: '$score' } } }
		])
		const winnerByTournament = new Map(winners.map(w => [w._id, w]))
		const winnerNames = await userNameMap([...winnerByTournament.values()].map(w => w.user))
		return {
			total,
			focus: { label: game.name, subtitle: `${total} tournaments` },
			rows: tournaments.map(tournament => {
				const winner = winnerByTournament.get(tournament.id)
				return {
					date: tournament.createdAt,
					id: tournament.id,
					label: tournament.createdAt.toLocaleDateString(),
					participants: tournament.gradingCount,
					winnerScore: winner?.score,
					winnerId: winner?.user,
					winnerName: winner !== undefined ? winnerNames.get(winner.user) ?? 'Unknown' : undefined
				}
			})
		}
	}
}

// Strategy history as a proper time series (stories 14, 23, 34)
const strategyTimeline: LensDefinition = {
	id: 'timeline',
	from: 'strategy',
	onto: 'tournament',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 200,
	renderer: 'timeline',
	description: 'Score and placement over time',
	display: ['placement', 'score', 'percentileRank', 'tokenCount'],
	pivots: [{ field: 'gameId', labelField: 'gameName', collection: 'game', text: 'Game' }],
	pipeline: async ({ id, params }) => {
		const submission = await SubmissionModel.findById(id)
		if (submission === null) { return { rows: [], total: 0 } }
		const match: Record<string, unknown> = { submission: id }
		const window: Record<string, Date> = {}
		if (params.from !== undefined) { window.$gte = params.from }
		if (params.to !== undefined) { window.$lte = params.to }
		if (Object.keys(window).length > 0) { match.createdAt = window }
		const gradings = await GradingModel
			.find(match)
			.sort({ createdAt: 1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await GradingModel.countDocuments(match)
		const gameNames = await gameNameMap([submission.game])
		return {
			total,
			focus: { label: submission.title, subtitle: `${total} tournaments entered` },
			rows: gradings.map(grading => ({
				date: grading.createdAt,
				id: grading.tournament,
				label: grading.createdAt.toLocaleDateString(),
				placement: grading.placement,
				score: grading.score,
				percentileRank: grading.percentileRank,
				tokenCount: grading.tokenCount,
				gameId: submission.game,
				gameName: gameNames.get(submission.game) ?? 'Unknown'
			}))
		}
	}
}

// User unified history across all games (story 67)
const userTimeline: LensDefinition = {
	id: 'timeline',
	from: 'user',
	onto: 'tournament',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'edge',
	maxRows: 500,
	renderer: 'timeline',
	description: 'Every grading, every game, one timeline',
	display: ['placement', 'score', 'percentileRank'],
	pivots: [{ field: 'gameId', labelField: 'gameName', collection: 'game', text: 'Game' }],
	pipeline: async ({ id, params }) => {
		const user = await UserModel.findById(id)
		if (user === null) { return { rows: [], total: 0 } }
		const match: Record<string, unknown> = { user: id }
		const window: Record<string, Date> = {}
		if (params.from !== undefined) { window.$gte = params.from }
		if (params.to !== undefined) { window.$lte = params.to }
		if (Object.keys(window).length > 0) { match.createdAt = window }
		const gradings = await GradingModel
			.find(match)
			.sort({ createdAt: 1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await GradingModel.countDocuments(match)
		const gameNames = await gameNameMap(gradings.map(g => g.game))
		return {
			total,
			focus: { label: user.username, subtitle: `${total} tournaments across all games` },
			rows: gradings.map(grading => ({
				date: grading.createdAt,
				id: grading.tournament,
				label: grading.createdAt.toLocaleDateString(),
				placement: grading.placement,
				score: grading.score,
				percentileRank: grading.percentileRank,
				gameId: grading.game,
				gameName: gameNames.get(grading.game) ?? 'Unknown'
			}))
		}
	}
}

// Streaks: current + longest win and participation streaks per user (25, 26)
const streaksGame: LensDefinition = {
	id: 'streaks',
	from: 'game',
	onto: 'user',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 200,
	renderer: 'table',
	description: 'Win and participation streaks in this game',
	display: ['currentWinStreak', 'longestWinStreak', 'activeStreak', 'tournaments'],
	pivots: [],
	pipeline: async ({ id, params }) => {
		const gradings = await GradingModel
			.find({ game: id })
			.sort({ createdAt: 1 })
			.select('user createdAt placement')
			.exec()
		// Group per user preserving chronology
		const perUser = new Map<string, Array<{ placement: number, createdAt: Date }>>()
		for (const g of gradings) {
			const list = perUser.get(g.user) ?? []
			list.push({ placement: g.placement, createdAt: g.createdAt })
			perUser.set(g.user, list)
		}
		// Window filter applied after grouping (events are chronological)
		const rows: Array<{ [k: string]: unknown }> = []
		for (const [userId, events] of perUser) {
			let currentWin = 0
			let longestWin = 0
			let longestActive = 0
			let activeRun = 0
			let prevTime = 0
			let currentWinActive = true
			for (const e of events) {
				if (e.placement === 1) {
					currentWin++
					longestWin = Math.max(longestWin, currentWin)
				} else {
					currentWin = 0
					currentWinActive = false
				}
				// Daily participation run (tournaments on consecutive days)
				const day = Math.floor(e.createdAt.getTime() / 86_400_000)
				activeRun = prevTime !== 0 && day - prevTime === 1 ? activeRun + 1 : 1
				prevTime = day
				longestActive = Math.max(longestActive, activeRun)
			}
			const lastEvent = events[events.length - 1]
			rows.push({
				date: lastEvent?.createdAt,
				id: userId,
				label: '',
				currentWinStreak: currentWinActive ? currentWin : 0,
				longestWinStreak: longestWin,
				activeStreak: longestActive,
				tournaments: events.length
			})
		}
		const names = await userNameMap(rows.map(r => String(r.id)))
		for (const row of rows) { row.label = names.get(String(row.id)) ?? 'Unknown' }
		rows.sort((a, b) => (Number(b.longestWinStreak) - Number(a.longestWinStreak)))
		return {
			rows: rows.slice(params.skip, params.skip + params.limit),
			total: rows.length,
			focus: undefined
		}
	}
}

// Champion succession chain (story 27) - the sequence of winners over time
const successionGame: LensDefinition = {
	id: 'succession',
	from: 'game',
	onto: 'tournament',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 200,
	renderer: 'timeline',
	description: 'Pass the torch: who held the crown, in order',
	display: ['winnerName', 'score'],
	pivots: [{ field: 'winnerId', labelField: 'winnerName', collection: 'user', text: 'Champion' }],
	pipeline: async ({ id, params }) => {
		const gradings = await GradingModel
			.find({ game: id, placement: 1 })
			.sort({ createdAt: 1 })
			.skip(params.skip)
			.limit(params.limit)
			.exec()
		const total = await GradingModel.countDocuments({ game: id, placement: 1 })
		const winnerNames = await userNameMap(gradings.map(g => g.user))
		let prevWinner: string | undefined
		return {
			rows: gradings.map(grading => {
				const label = winnerNames.get(grading.user) ?? 'Unknown'
				const takeover = prevWinner !== undefined && prevWinner !== grading.user
				prevWinner = grading.user
				return {
					date: grading.createdAt,
					id: grading.tournament,
					label: takeover ? `${label} takes the crown` : `${label} defends`,
					score: grading.score,
					winnerId: grading.user,
					winnerName: label
				}
			}),
			total
		}
	}
}

// Co-occurrence: users who shared the most tournaments with the anchor (16, 69)
const rivalsUser: LensDefinition = {
	id: 'rivals',
	from: 'user',
	onto: 'user',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 100,
	renderer: 'table',
	description: 'Users who shared the most tournaments (rivals)',
	display: ['shared', 'theirWins'],
	pivots: [],
	pipeline: async ({ id, params }) => {
		const myTournaments = await GradingModel.find({ user: id }).distinct('tournament')
		if (myTournaments.length === 0) { return { rows: [], total: 0 } }
		const capped = myTournaments.slice(-100)
		const co = await GradingModel.aggregate<{ _id: string, shared: number }>([
			{ $match: { tournament: { $in: capped }, user: { $ne: id } } },
			{ $group: { _id: '$user', shared: { $sum: 1 } } },
			{ $sort: { shared: -1 } },
			{ $limit: 100 }
		])
		const names = await userNameMap(co.map(c => c._id))
		const wins = await GradingModel.aggregate<{ _id: string, wins: number }>([
			{ $match: { user: { $in: co.map(c => c._id) }, placement: 1 } },
			{ $group: { _id: '$user', wins: { $sum: 1 } } }
		])
		const winMap = new Map(wins.map(w => [w._id, w.wins]))
		return {
			rows: co.slice(params.skip, params.skip + params.limit).map(c => ({
				id: c._id,
				label: names.get(c._id) ?? 'Unknown',
				shared: c.shared,
				theirWins: winMap.get(c._id) ?? 0
			})),
			total: co.length
		}
	}
}

// Head-to-head: dual anchor set comparison (54, 57) - anchor in URL, rival in 'me'
const headToHead: LensDefinition = {
	id: 'head-to-head',
	from: 'user',
	onto: 'tournament',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 200,
	renderer: 'table',
	description: 'Shared tournaments, side by side (rival via rival= param)',
	display: ['myPlacement', 'theirPlacement', 'myScore', 'theirScore'],
	pivots: [{ field: 'gameId', labelField: 'gameName', collection: 'game', text: 'Game' }],
	pipeline: async ({ id: anchorId, params }) => {
		const id = anchorId ?? ''
		const rival = params.me
		if (rival === undefined || rival.length === 0) {
			return { rows: [], total: 0, focus: { label: 'Head to head', subtitle: 'pick a rival to compare' } }
		}
		const [mine, theirs] = await Promise.all([
			GradingModel.find({ user: id }).exec(),
			GradingModel.find({ user: rival }).exec()
		])
		const theirsByTournament = new Map(theirs.map(t => [t.tournament, t]))
		const shared = mine.filter(m => theirsByTournament.has(m.tournament))
		const nameMap = await userNameMap([id, rival])
		const myName = nameMap.get(id) ?? 'You'
		const rivalName = nameMap.get(rival) ?? 'Rival'
		const gameNames = await gameNameMap(shared.map(s => s.game))
		const rows = shared
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			.slice(params.skip, params.skip + params.limit)
			.map(m => {
				const other = theirsByTournament.get(m.tournament)
				return {
					date: m.createdAt,
					id: m.tournament,
					label: m.createdAt.toLocaleDateString(),
					myPlacement: m.placement,
					theirPlacement: other?.placement,
					myScore: m.score,
					theirScore: other?.score,
					gameId: m.game,
					gameName: gameNames.get(m.game) ?? 'Unknown'
				}
			})
		return {
			rows,
			total: shared.length,
			focus: { label: `${myName} vs ${rivalName}`, subtitle: `${shared.length} shared tournaments` }
		}
	}
}

// Negative: silent drops - top-10% users with no recent gradings (48)
const silentDrops: LensDefinition = {
	id: 'silent-drops',
	from: 'game',
	onto: 'user',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 200,
	renderer: 'table',
	description: 'Top players who stopped showing up',
	display: ['lastSeen', 'bestPlacement', 'tournaments'],
	pivots: [],
	pipeline: async ({ id, params }) => {
		const cutoff = params.to ?? new Date()
		const lookback = new Date(cutoff.getTime() - 30 * 86_400_000)
		const perUser = await GradingModel.aggregate<{ _id: string, last: Date, best: number, tournaments: number }>([
			{ $match: { game: id, createdAt: { $lte: cutoff } } },
			{ $group: { _id: '$user', last: { $max: '$createdAt' }, best: { $min: '$placement' }, tournaments: { $sum: 1 } } },
			{ $match: { last: { $lt: lookback } } },
			{ $sort: { best: 1 } },
			{ $limit: params.limit + params.skip }
		])
		const names = await userNameMap(perUser.map(p => p._id))
		return {
			rows: perUser.slice(params.skip).map(p => ({
				date: p.last,
				id: p._id,
				label: names.get(p._id) ?? 'Unknown',
				lastSeen: p.last.toLocaleDateString(),
				bestPlacement: p.best,
				tournaments: p.tournaments
			})),
			total: perUser.length
		}
	}
}

// Derived metric: dominance per game (35) - documented, versioned v1 formula
// dominance = 0.5 * winRate + 0.3 * activityShare + 0.2 * peakScore, windowed
const dominanceGame: LensDefinition = {
	id: 'dominance',
	from: 'game',
	onto: 'user',
	scopes: 'document',
	cardinality: 'many',
	dateField: 'createdAt',
	costClass: 'fanout',
	maxRows: 200,
	renderer: 'table',
	description: 'Composite strength: winRate 50%, activity 30%, peak 20%',
	display: ['dominance', 'winRate', 'activity', 'peakScore'],
	pivots: [],
	pipeline: async ({ id, params }) => {
		const gradings = await GradingModel
			.find({ game: id })
			.select('user placement score')
			.exec()
		const perUser = new Map<string, { total: number, wins: number, peak: number }>()
		for (const g of gradings) {
			const entry = perUser.get(g.user) ?? { total: 0, wins: 0, peak: 0 }
			entry.total++
			if (g.placement === 1) { entry.wins++ }
			entry.peak = Math.max(entry.peak, g.score)
			perUser.set(g.user, entry)
		}
		const maxPeak = Math.max(1, ...[...perUser.values()].map(p => p.peak))
		const rows = [...perUser.entries()].map(([userId, stat]) => {
			const winRate = stat.total > 0 ? stat.wins / stat.total : 0
			const activity = stat.total / gradings.length
			const peak = stat.peak / maxPeak
			return {
				id: userId,
				label: '',
				dominance: Math.round((0.5 * winRate + 0.3 * activity + 0.2 * peak) * 1000) / 1000,
				winRate: Math.round(winRate * 1000) / 1000,
				activity: Math.round(activity * 1000) / 1000,
				peakScore: Math.round(stat.peak * 10) / 10
			}
		})
		const names = await userNameMap(rows.map(r => String(r.id)))
		for (const row of rows) { row.label = names.get(String(row.id)) ?? 'Unknown' }
		rows.sort((a, b) => Number(b.dominance) - Number(a.dominance))
		return { rows: rows.slice(params.skip, params.skip + params.limit), total: rows.length }
	}
}

export const lenses: LensDefinition[] = [
	browseGame,
	gameTournaments,
	gameTimeline,
	gameStrategies,
	leaderboardGame,
	streaksGame,
	dominanceGame,
	successionGame,
	silentDrops,
	browseUser,
	userGamesCreated,
	userGamesPlayed,
	userStrategies,
	leaderboardUser,
	userTimeline,
	rivalsUser,
	headToHead,
	browseTournament,
	browseStrategy,
	strategyHistory,
	strategyTimeline,
	tournamentParticipants
]

/** Metadata the UI needs to plan navigation - no pipeline execution. */
export function lensMetaFor (from: string): Array<{
	id: string
	description: string
	renderer: string
	scopes: string
}> {
	return lenses
		.filter(lens => lens.from === from)
		.map(lens => ({
			id: lens.id,
			description: lens.description,
			renderer: lens.renderer,
			scopes: lens.scopes
		}))
}
const registry = new Map<string, LensDefinition>()
for (const lens of lenses) {
	const key = `${lens.from}:${lens.id}`
	if (registry.has(key)) {
		throw new Error(`Duplicate lens registration: ${key}`)
	}
	registry.set(key, lens)
}

export function getLens (from: string, lensId: string): LensDefinition | undefined {
	return registry.get(`${from}:${lensId}`)
}

export function lensIdsFor (from: string): Array<{ id: string, description: string, renderer: string }> {
	return lenses
		.filter(lens => lens.from === from)
		.map(lens => ({ id: lens.id, description: lens.description, renderer: lens.renderer }))
}

export function collectionExists (from: string): boolean {
	return lenses.some(lens => lens.from === from)
}
