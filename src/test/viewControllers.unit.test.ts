import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import {
	viewCollection,
	viewDocument,
	viewMeta
} from '../controllers/users/viewController.js'
import GameModel from '../models/Game.js'
import GradingModel from '../models/Grading.js'
import SubmissionModel from '../models/Submission.js'
import TournamentModel from '../models/Tournament.js'
import UserModel from '../models/User.js'

import { fakeReq, fakeRes } from './fakeExpress.js'
import connectToInMemoryMongoDB, { disconnectFromInMemoryMongoDB } from './mongoMemoryReplSetConnector.js'

// Unit tests for the view controllers — the layer where the regressions
// lived (collection-scope lens called with an anchor, unknown lens/collection
// 400s, invalid query params). Controllers are driven with fake req/res.

describe('view controllers', () => {
	let gameId = ''
	let userId = ''
	let tournamentId = ''
	let strategyId = ''

	before(async () => {
		await connectToInMemoryMongoDB()

		const author = await UserModel.create({
			email: 'controller@test.dev',
			password: 'correct-horse-battery-staple',
			username: 'Controller Author'
		})
		userId = author.id

		const game = await GameModel.create({
			name: 'Controller Game',
			summary: 'Controller test game',
			description: 'Long description for the controller test game',
			files: { 'main.ts': 'export const Game = {}' },
			apiType: 'turnBased',
			exampleStrategy: 'export const strategy = () => {}',
			minPlayers: 2,
			maxPlayers: 2,
			user: userId
		})
		gameId = game.id

		const submission = await SubmissionModel.create({
			title: 'Controller Strategy',
			code: 'export const strategy = () => {}',
			user: userId,
			game: gameId,
			active: true,
			passedEvaluation: true
		})
		strategyId = submission.id

		const tournament = await TournamentModel.create({
			game: gameId,
			gradingCount: 1,
			tournamentExecutionTime: 1234
		})
		tournamentId = tournament.id

		await GradingModel.create({
			tournament: tournamentId,
			game: gameId,
			user: userId,
			submission: strategyId,
			score: 100,
			placement: 1,
			percentileRank: 100,
			tokenCount: 10,
			avgExecutionTime: 1
		})
	})

	after(async () => {
		await disconnectFromInMemoryMongoDB()
	})

	/* -------------------------------- meta ---------------------------------- */

	it('viewMeta returns lens metadata without running pipelines', async () => {
		const { res, done } = fakeRes()
		await viewMeta(fakeReq({ params: { collection: 'game' } }), res)
		const recorded = await done
		assert.equal(recorded.statusCode, 200)
		const lenses = (recorded.body as { lenses: Array<{ id: string, scopes: string }> }).lenses
		assert.ok(lenses.some(l => l.id === 'browse' && l.scopes === 'collection'))
		assert.ok(lenses.some(l => l.id === 'tournaments' && l.scopes === 'document'))
	})

	it('viewMeta 400s on unknown collection', async () => {
		const { res, done } = fakeRes()
		await assert.rejects(
			viewMeta(fakeReq({ params: { collection: 'nope' } }), res),
			/Unknown collection/
		)
	})

	/* ---------------------------- collection scope --------------------------- */

	it('viewCollection browses all four collections', async () => {
		for (const collection of ['game', 'user', 'tournament', 'strategy']) {
			const { res, done } = fakeRes()
			await viewCollection(fakeReq({ params: { collection }, query: { lens: 'browse', limit: '5' } }), res)
			const recorded = await done
			assert.equal(recorded.statusCode, 200, `${collection} browse must be 200`)
			const body = recorded.body as { rows: unknown[], total: number, lens: { from: string } }
			assert.ok(Array.isArray(body.rows))
			assert.equal(typeof body.total, 'number')
			assert.equal(body.lens.from, collection)
		}
	})

	it('viewCollection applies sort param to rows', async () => {
		const { res, done } = fakeRes()
		await viewCollection(fakeReq({ params: { collection: 'user' }, query: { lens: 'leaderboard', sort: 'wins', limit: '5' } }), res)
		const recorded = await done
		assert.equal(recorded.statusCode, 200)
		const body = recorded.body as { rows: Array<{ wins: number }> }
		const wins = body.rows.map(r => r.wins)
		assert.deepEqual(wins, [...wins].sort((a, b) => b - a), 'rows must be sorted by wins desc')
	})

	/* ----------------------------- document scope ---------------------------- */

	it('viewDocument works for every document lens of every collection', async () => {
		const matrix: Array<[string, string, string]> = [
			['game', gameId, 'tournaments'],
			['game', gameId, 'timeline'],
			['game', gameId, 'strategies'],
			['game', gameId, 'streaks'],
			['game', gameId, 'dominance'],
			['game', gameId, 'succession'],
			['game', gameId, 'silent-drops'],
			['user', userId, 'games-created'],
			['user', userId, 'games-played'],
			['user', userId, 'strategies'],
			['user', userId, 'timeline'],
			['user', userId, 'rivals'],
			['tournament', tournamentId, 'participants'],
			['strategy', strategyId, 'history'],
			['strategy', strategyId, 'timeline']
		]
		for (const [collection, id, lens] of matrix) {
			const { res, done } = fakeRes()
			await viewDocument(fakeReq({ params: { collection, id }, query: { lens, limit: '5' } }), res)
			const recorded = await done
			assert.equal(recorded.statusCode, 200, `${collection}/${lens} must be 200`)
			const body = recorded.body as { rows: unknown[], lens: { display: string[], pivots: unknown[] } }
			assert.ok(Array.isArray(body.rows), `${collection}/${lens} rows must be an array`)
			assert.ok(body.lens.display !== undefined, `${collection}/${lens} must declare display fields`)
			assert.ok(body.lens.pivots !== undefined, `${collection}/${lens} must declare pivots`)
		}
	})

	it('head-to-head resolves with a rival and degrades gracefully without one', async () => {
		const empty = fakeRes()
		await viewDocument(fakeReq({ params: { collection: 'user', id: userId }, query: { lens: 'head-to-head' } }), empty.res)
		const emptyBody = (await empty.done).body as { rows: unknown[] }
		assert.equal(emptyBody.rows.length, 0)

		const rival = await UserModel.create({
			email: 'controller-rival@test.dev',
			password: 'correct-horse-battery-staple',
			username: 'Controller Rival'
		})
		await GradingModel.create({
			tournament: tournamentId,
			game: gameId,
			user: rival.id,
			submission: strategyId,
			score: 50,
			placement: 2,
			percentileRank: 50,
			tokenCount: 10,
			avgExecutionTime: 1
		})

		const { res, done } = fakeRes()
		await viewDocument(fakeReq({ params: { collection: 'user', id: userId }, query: { lens: 'head-to-head', me: rival.id } }), res)
		const body = (await done).body as { rows: Array<{ myPlacement: number, theirPlacement: number }>, focus: { label: string } }
		assert.equal(body.rows.length, 1)
		const row = body.rows[0]
		assert.ok(row !== undefined, 'head-to-head must return the shared tournament')
		assert.equal(row.myPlacement, 1)
		assert.equal(row.theirPlacement, 2)
		assert.ok(body.focus.label.includes('vs'))
	})

	it('participants resolves winner labels via pivot fields', async () => {
		const { res, done } = fakeRes()
		await viewDocument(fakeReq({ params: { collection: 'tournament', id: tournamentId }, query: { lens: 'participants' } }), res)
		const body = (await done).body as { rows: Array<{ placement: number, label: string, strategyId: string }> }
		const top = body.rows[0]
		assert.ok(top !== undefined, 'participants must return standings')
		assert.equal(top.placement, 1)
		assert.equal(top.label, 'Controller Author')
		assert.equal(typeof top.strategyId, 'string')
	})

	/* ------------------------------ error paths ------------------------------ */

	it('400s on unknown collection', async () => {
		const { res } = fakeRes()
		await assert.rejects(
			viewCollection(fakeReq({ params: { collection: 'nope' }, query: { lens: 'browse' } }), res),
			/Unknown collection/
		)
	})

	it('400s on unknown lens for a known collection', async () => {
		const { res } = fakeRes()
		await assert.rejects(
			viewDocument(fakeReq({ params: { collection: 'game', id: gameId }, query: { lens: 'nope' } }), res),
			/Unknown lens/
		)
	})

	it('400s when a collection-scope lens is called with an anchor (the old bug)', async () => {
		const { res } = fakeRes()
		await assert.rejects(
			viewDocument(fakeReq({ params: { collection: 'game', id: gameId }, query: { lens: 'browse' } }), res),
			/does not take an anchor/
		)
	})

	it('400s when a document-scope lens is called without an anchor', async () => {
		const { res } = fakeRes()
		await assert.rejects(
			viewCollection(fakeReq({ params: { collection: 'game' }, query: { lens: 'tournaments' } }), res),
			/requires an anchor/
		)
	})

	it('400s on invalid query params', async () => {
		await assert.rejects(
			viewCollection(fakeReq({ params: { collection: 'game' }, query: { lens: 'browse', limit: '500' } }), fakeRes().res),
			/Invalid view query/
		)
		await assert.rejects(
			viewCollection(fakeReq({ params: { collection: 'game' }, query: { lens: 'browse', dir: 'diagonal' } }), fakeRes().res),
			/Invalid view query/
		)
	})

	it('returns empty rows (not an error) for a valid anchor with no related data', async () => {
		const ghost = await UserModel.create({
			email: 'ghost@test.dev',
			password: 'correct-horse-battery-staple',
			username: 'Ghost User'
		})
		const { res, done } = fakeRes()
		await viewDocument(fakeReq({ params: { collection: 'user', id: ghost.id }, query: { lens: 'games-played' } }), res)
		const recorded = await done
		assert.equal(recorded.statusCode, 200)
		const body = recorded.body as { rows: unknown[], total: number }
		assert.equal(body.rows.length, 0)
		assert.equal(body.total, 0)
	})

	it('row output always carries resolved labels for pivot fields (no raw-id-only rows)', async () => {
		const { res, done } = fakeRes()
		await viewDocument(fakeReq({ params: { collection: 'game', id: gameId }, query: { lens: 'strategies' } }), res)
		const body = (await done).body as { rows: Array<{ label: string }>, lens: { pivots: Array<{ field: string, labelField: string }> } }
		for (const row of body.rows) {
			assert.equal(typeof row.label, 'string')
			for (const pivot of body.lens.pivots) {
				assert.equal(typeof row[pivot.labelField as keyof typeof row], 'string', `pivot ${pivot.field} must resolve ${pivot.labelField}`)
			}
		}
	})
})
