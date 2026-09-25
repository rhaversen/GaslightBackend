import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { getLens, lenses } from '../lenses/registry.js'
import GameModel from '../models/Game.js'
import GradingModel from '../models/Grading.js'
import SubmissionModel from '../models/Submission.js'
import TournamentModel from '../models/Tournament.js'
import UserModel from '../models/User.js'

import connectToInMemoryMongoDB, { disconnectFromInMemoryMongoDB } from './mongoMemoryReplSetConnector.js'

// Every registered lens gets at least one pipeline test against seeded data,
// plus contract checks that hold for all lenses (rows array, total, resolved
// pivot labels, declared maxRows respected).

const baseParams = { limit: 20, skip: 0, dir: 'desc' as const }

describe('lens pipelines (all lenses)', () => {
	let gameId = ''
	let userId = ''
	let rivalId = ''
	let tournamentAId = ''
	let tournamentBId = ''
	let strategyId = ''

	before(async () => {
		await connectToInMemoryMongoDB()

		const author = await UserModel.create({
			email: 'pipeline@test.dev',
			password: 'correct-horse-battery-staple',
			username: 'Pipeline Champion'
		})
		userId = author.id

		const rival = await UserModel.create({
			email: 'pipeline-rival@test.dev',
			password: 'correct-horse-battery-staple',
			username: 'Pipeline Rival'
		})
		rivalId = rival.id

		const game = await GameModel.create({
			name: 'Pipeline Game',
			summary: 'Pipeline test game',
			description: 'Long description for the pipeline test game',
			files: { 'main.ts': 'export const Game = {}' },
			apiType: 'turnBased',
			exampleStrategy: 'export const strategy = () => {}',
			minPlayers: 2,
			maxPlayers: 2,
			user: userId
		})
		gameId = game.id

		const submission = await SubmissionModel.create({
			title: 'Pipeline Strategy',
			code: 'export const strategy = () => {}',
			user: userId,
			game: gameId,
			active: true,
			passedEvaluation: true
		})
		strategyId = submission.id

		const rivalSubmission = await SubmissionModel.create({
			title: 'Rival Strategy',
			code: 'export const strategy = () => {}',
			user: rivalId,
			game: gameId,
			active: true,
			passedEvaluation: true
		})

		// Two tournaments; the author wins both, the rival places 2nd each
		const tournamentA = await TournamentModel.create({
			game: gameId,
			gradingCount: 2,
			tournamentExecutionTime: 100
		})
		tournamentAId = tournamentA.id
		const tournamentB = await TournamentModel.create({
			game: gameId,
			gradingCount: 2,
			tournamentExecutionTime: 110
		})
		tournamentBId = tournamentB.id

		await GradingModel.insertMany([
			{ tournament: tournamentAId, game: gameId, user: userId, submission: strategyId, score: 200, placement: 1, percentileRank: 100, tokenCount: 10, avgExecutionTime: 1 },
			{ tournament: tournamentAId, game: gameId, user: rivalId, submission: rivalSubmission.id, score: 90, placement: 2, percentileRank: 50, tokenCount: 12, avgExecutionTime: 2 },
			{ tournament: tournamentBId, game: gameId, user: userId, submission: strategyId, score: 150, placement: 1, percentileRank: 100, tokenCount: 10, avgExecutionTime: 1 },
			{ tournament: tournamentBId, game: gameId, user: rivalId, submission: rivalSubmission.id, score: 80, placement: 2, percentileRank: 50, tokenCount: 12, avgExecutionTime: 2 }
		])
	})

	after(async () => {
		await disconnectFromInMemoryMongoDB()
	})

	it('registers all lenses with unique collection:id keys', () => {
		assert.equal(lenses.length, 22)
		const keys = new Set(lenses.map(l => `${l.from}:${l.id}`))
		assert.equal(keys.size, lenses.length, 'no duplicate registration')
	})

	function assertRowContract (lensId: string, result: { rows: Array<Record<string, unknown>>, total: number }, maxRows: number): void {
		assert.ok(Array.isArray(result.rows), `${lensId}: rows must be an array`)
		assert.equal(typeof result.total, 'number', `${lensId}: total must be a number`)
		assert.ok(result.rows.length <= maxRows, `${lensId}: rows must respect maxRows`)
		for (const row of result.rows) {
			assert.equal(typeof row.label, 'string', `${lensId}: every row needs a resolved label`)
			assert.ok(!(typeof row.id === 'string' && row.id.length === 0), `${lensId}: row ids must be non-empty`)
		}
	}

	function assertPivotLabels (lensId: string, lensPivots: Array<{ field: string, labelField: string }>, rows: Array<Record<string, unknown>>): void {
		for (const pivot of lensPivots) {
			for (const row of rows) {
				const hasId = typeof row[pivot.field] === 'string'
				const hasLabel = typeof row[pivot.labelField] === 'string'
				if (hasId) {
					assert.ok(hasLabel, `${lensId}: pivot ${pivot.field} must carry resolved ${pivot.labelField}`)
				}
			}
		}
	}

	/* --------------------------------- game ---------------------------------- */

	it('game/browse returns games with author pivot resolved', async () => {
		const lens = getLens('game', 'browse')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ params: baseParams })
		assertRowContract('game/browse', result, lens.maxRows)
		const row = result.rows.find(r => r.label === 'Pipeline Game')
		assert.ok(row !== undefined)
		assert.equal(row.authorName, 'Pipeline Champion')
		assertPivotLabels('game/browse', lens.pivots, result.rows)
	})

	it('game/tournaments resolves the winner of each tournament', async () => {
		const lens = getLens('game', 'tournaments')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: gameId, params: baseParams })
		assertRowContract('game/tournaments', result, lens.maxRows)
		assert.equal(result.total, 2)
		const winnerNames = result.rows.map(r => r.winnerName)
		assert.deepEqual(winnerNames, ['Pipeline Champion', 'Pipeline Champion'])
	})

	it('game/timeline returns chronological rows', async () => {
		const lens = getLens('game', 'timeline')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: gameId, params: baseParams })
		assertRowContract('game/timeline', result, lens.maxRows)
		const dates = result.rows.map(r => new Date(String(r.date)).getTime())
		assert.deepEqual(dates, [...dates].sort((a, b) => a - b), 'timeline must be chronological')
	})

	it('game/strategies lists strategies of the game', async () => {
		const lens = getLens('game', 'strategies')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: gameId, params: baseParams })
		assertRowContract('game/strategies', result, lens.maxRows)
		assert.ok(result.rows.some(r => r.label === 'Pipeline Strategy'))
		assertPivotLabels('game/strategies', lens.pivots, result.rows)
	})

	it('game/streaks computes win streaks (author won both tournaments)', async () => {
		const lens = getLens('game', 'streaks')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: gameId, params: baseParams })
		assertRowContract('game/streaks', result, lens.maxRows)
		const champion = result.rows.find(r => r.label === 'Pipeline Champion')
		assert.ok(champion !== undefined)
		assert.equal(champion.longestWinStreak, 2)
		assert.equal(champion.currentWinStreak, 2)
		const rival = result.rows.find(r => r.label === 'Pipeline Rival')
		assert.ok(rival !== undefined)
		assert.equal(rival.longestWinStreak, 0)
	})

	it('game/dominance ranks the two-time champion first', async () => {
		const lens = getLens('game', 'dominance')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: gameId, params: baseParams })
		assertRowContract('game/dominance', result, lens.maxRows)
		const top = result.rows[0]
		const second = result.rows[1]
		assert.ok(top !== undefined && second !== undefined, 'dominance must return at least two rows')
		assert.equal(top.label, 'Pipeline Champion')
		assert.ok(Number(top.dominance) > Number(second.dominance))
	})

	it('game/succession narrates takeovers and defenses', async () => {
		const lens = getLens('game', 'succession')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: gameId, params: baseParams })
		assertRowContract('game/succession', result, lens.maxRows)
		const first = result.rows[0]
		assert.ok(first !== undefined, 'succession must return rows')
		assert.match(String(first.label), /defends|takes the crown/)
	})

	it('game/silent-drops only shows users inactive in the last 30 days', async () => {
		const lens = getLens('game', 'silent-drops')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: gameId, params: { ...baseParams } })
		assertRowContract('game/silent-drops', result, lens.maxRows)
		assert.equal(result.rows.length, 0, 'fresh seed gradings must not be silent drops')
	})

	/* --------------------------------- user ---------------------------------- */

	it('user/browse returns users with gamesPlayed', async () => {
		const lens = getLens('user', 'browse')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ params: baseParams })
		assertRowContract('user/browse', result, lens.maxRows)
		const champion = result.rows.find(r => r.label === 'Pipeline Champion')
		assert.ok(champion !== undefined)
		assert.equal(champion.gamesPlayed, 1)
	})

	it('user/games-created lists authored games', async () => {
		const lens = getLens('user', 'games-created')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: userId, params: baseParams })
		assertRowContract('user/games-created', result, lens.maxRows)
		assert.ok(result.rows.some(r => r.label === 'Pipeline Game'))
	})

	it('user/games-played aggregates placements per game', async () => {
		const lens = getLens('user', 'games-played')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: userId, params: baseParams })
		assertRowContract('user/games-played', result, lens.maxRows)
		const row = result.rows.find(r => r.label === 'Pipeline Game')
		assert.ok(row !== undefined)
		assert.equal(row.tournaments, 2)
		assert.equal(row.bestPlacement, 1)
	})

	it('user/strategies lists strategies with stats and game pivot', async () => {
		const lens = getLens('user', 'strategies')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: userId, params: baseParams })
		assertRowContract('user/strategies', result, lens.maxRows)
		const row = result.rows.find(r => r.label === 'Pipeline Strategy')
		assert.ok(row !== undefined)
		assert.equal(row.tournaments, 2)
		assert.equal(row.gameName, 'Pipeline Game')
		assertPivotLabels('user/strategies', lens.pivots, result.rows)
	})

	it('user/leaderboard aggregates tournaments, wins, gamesPlayed', async () => {
		const lens = getLens('user', 'leaderboard')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ params: baseParams })
		assertRowContract('user/leaderboard', result, lens.maxRows)
		const champion = result.rows.find(r => r.label === 'Pipeline Champion')
		assert.ok(champion !== undefined)
		assert.equal(champion.tournaments, 2)
		assert.equal(champion.wins, 2)
		assert.equal(champion.gamesPlayed, 1)
	})

	it('user/timeline merges gradings across games chronologically', async () => {
		const lens = getLens('user', 'timeline')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: userId, params: baseParams })
		assertRowContract('user/timeline', result, lens.maxRows)
		assert.equal(result.total, 2)
		const dates = result.rows.map(r => new Date(String(r.date)).getTime())
		assert.deepEqual(dates, [...dates].sort((a, b) => a - b))
	})

	it('user/rivals ranks the co-participant first with shared count', async () => {
		const lens = getLens('user', 'rivals')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: userId, params: baseParams })
		assertRowContract('user/rivals', result, lens.maxRows)
		const rival = result.rows.find(r => r.label === 'Pipeline Rival')
		assert.ok(rival !== undefined)
		assert.equal(rival.shared, 2)
	})

	it('user/head-to-head pairs shared tournaments and degrades without rival', async () => {
		const lens = getLens('user', 'head-to-head')
		assert.ok(lens !== undefined)
		const empty = await lens.pipeline({ id: userId, params: baseParams })
		assert.equal(empty.rows.length, 0)
		assert.ok(empty.focus !== undefined)

		const result = await lens.pipeline({ id: userId, params: { ...baseParams, me: rivalId } })
		assertRowContract('user/head-to-head', result, lens.maxRows)
		assert.equal(result.rows.length, 2)
		const row = result.rows[0]
		assert.ok(row !== undefined, 'head-to-head must return shared rows')
		assert.equal(row.myPlacement, 1)
		assert.equal(row.theirPlacement, 2)
		assert.ok(result.focus !== undefined && result.focus.label.includes('vs'))
	})

	/* ------------------------------- strategy -------------------------------- */

	it('strategy/history lists its tournaments with results', async () => {
		const lens = getLens('strategy', 'history')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: strategyId, params: baseParams })
		assertRowContract('strategy/history', result, lens.maxRows)
		assert.equal(result.total, 2)
		assert.ok(result.rows.every(r => r.placement === 1))
	})

	it('strategy/timeline returns chronological results for the series plot', async () => {
		const lens = getLens('strategy', 'timeline')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: strategyId, params: baseParams })
		assertRowContract('strategy/timeline', result, lens.maxRows)
		const dates = result.rows.map(r => new Date(String(r.date)).getTime())
		assert.deepEqual(dates, [...dates].sort((a, b) => a - b))
	})

	/* ------------------------------- tournament ------------------------------ */

	it('tournament/participants returns full standings', async () => {
		const lens = getLens('tournament', 'participants')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: tournamentAId, params: baseParams })
		assertRowContract('tournament/participants', result, lens.maxRows)
		assert.equal(result.total, 2)
		const top = result.rows[0]
		assert.ok(top !== undefined, 'participants must return standings')
		assert.equal(top.label, 'Pipeline Champion')
		assert.equal(top.placement, 1)
		assertPivotLabels('tournament/participants', lens.pivots, result.rows)
	})

	/* ------------------------------ window guards ---------------------------- */

	it('timeline lenses honor the from/to window', async () => {
		const lens = getLens('game', 'timeline')
		assert.ok(lens !== undefined)
		const future = await lens.pipeline({
			id: gameId,
			params: { ...baseParams, from: new Date(Date.now() + 86_400_000) }
		})
		assert.equal(future.rows.length, 0, 'future window must exclude all seeded tournaments')
	})
})
