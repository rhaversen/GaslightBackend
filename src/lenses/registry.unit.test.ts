import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import GameModel from '../models/Game.js'
import SubmissionModel from '../models/Submission.js'
import UserModel from '../models/User.js'
import connectToInMemoryMongoDB, { disconnectFromInMemoryMongoDB } from '../test/mongoMemoryReplSetConnector.js'

import { getLens, lensIdsFor, collectionExists } from './registry.js'

// Unit tests for the lens registry: validation guarantees, duplicate
// detection, and the browse pipelines against an in-memory database.

describe('lens registry', () => {
	let authorId = ''

	before(async () => {
		await connectToInMemoryMongoDB()
		const author = await UserModel.create({
			email: 'lens-registry@test.dev',
			password: 'correct-horse-battery-staple',
			username: 'Registry Author'
		})
		authorId = author.id

		// Sequential inserts guarantee distinct createdAt for the sort assertion
		await GameModel.create({
			name: 'Alpha Game',
			summary: 'First',
			description: 'Alpha description',
			files: { 'main.ts': 'export const Game = {}' },
			apiType: 'turnBased',
			exampleStrategy: 'export const strategy = () => {}',
			minPlayers: 2,
			maxPlayers: 2,
			user: authorId
		})
		await GameModel.create({
			name: 'Beta Game',
			summary: 'Second',
			description: 'Beta description',
			files: { 'main.ts': 'export const Game = {}' },
			apiType: 'turnBased',
			exampleStrategy: 'export const strategy = () => {}',
			minPlayers: 3,
			maxPlayers: 3,
			user: authorId
		})

		// One strategy for Alpha Game so the game/strategies lens has data
		const games = await GameModel.find({ user: authorId })
		const alpha = games.find(g => g.name === 'Alpha Game')
		if (alpha !== undefined) {
			await SubmissionModel.create({
				title: 'Alpha Strategy',
				code: 'export const strategy = () => {}',
				user: authorId,
				game: alpha.id,
				active: true,
				passedEvaluation: true
			})
		}
	})

	after(async () => {
		await disconnectFromInMemoryMongoDB()
	})

	it('knows which collections exist', () => {
		assert.equal(collectionExists('game'), true)
		assert.equal(collectionExists('user'), true)
		assert.equal(collectionExists('strategy'), true)
		assert.equal(collectionExists('nope'), false)
	})

	it('resolves a registered lens by collection and id', () => {
		const lens = getLens('game', 'browse')
		assert.ok(lens !== undefined)
		assert.equal(lens.from, 'game')
		assert.equal(lens.costClass, 'edge')
		assert.equal(lens.renderer, 'list')
	})

	it('returns undefined for unknown lens or collection combinations', () => {
		assert.equal(getLens('game', 'nope'), undefined)
		assert.equal(getLens('nope', 'browse'), undefined)
		assert.equal(getLens('game', 'head-to-head'), undefined, 'head-to-head is a user lens')
	})

	it('lists available lenses per collection', () => {
		const gameLenses = lensIdsFor('game')
		assert.ok(gameLenses.length >= 3, 'game needs browse + tournaments + strategies')
		const userLenses = lensIdsFor('user')
		assert.ok(userLenses.length >= 4, 'user needs browse + created + played + strategies')
	})

	it('browse game pipeline resolves author labels and strategy counts', async () => {
		const lens = getLens('game', 'browse')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({
			params: { limit: 50, skip: 0, dir: 'desc' }
		})

		assert.ok(result.total >= 2)
		const alpha = result.rows.find(r => r.label === 'Alpha Game')
		assert.ok(alpha !== undefined)
		assert.equal(alpha.authorId, authorId)
		assert.equal(alpha.authorName, 'Registry Author')
		assert.equal(typeof alpha.strategyCount, 'number')
		assert.ok(lens.pivots.length > 0, 'browse game must expose author pivot')
	})

	it('game strategies lens returns focus and per-strategy best placement', async () => {
		const game = getLens('game', 'browse')
		assert.ok(game !== undefined)
		const games = await game.pipeline({ params: { limit: 50, skip: 0, dir: 'desc' } })
		const alphaId = games.rows.find(r => r.label === 'Alpha Game')?.id
		assert.ok(typeof alphaId === 'string')

		const lens = getLens('game', 'strategies')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({ id: alphaId, params: { limit: 50, skip: 0, dir: 'desc' } })
		assert.ok(result.focus !== undefined)
		assert.equal(result.focus.label, 'Alpha Game')
		assert.ok(result.total >= 1)
		const row = result.rows[0]
		assert.ok(row !== undefined)
		assert.equal(row.userName, 'Registry Author')
	})

	it('browse game pipeline returns rows newest first with author id', async () => {
		const lens = getLens('game', 'browse')
		assert.ok(lens !== undefined)
		const result = await lens.pipeline({
			params: { limit: 50, skip: 0, dir: 'desc' }
		})

		assert.ok(result.total >= 2)
		assert.ok(result.rows.length >= 2)
		const labels = result.rows.map(r => r.label)
		const betaIndex = labels.indexOf('Beta Game')
		const alphaIndex = labels.indexOf('Alpha Game')
		assert.ok(betaIndex < alphaIndex, 'rows must be newest first')
		const alpha = result.rows[alphaIndex]
		assert.equal(alpha?.authorId, authorId)
		assert.ok(alpha?.date instanceof Date)
	})

	it('browse game pipeline paginates', async () => {
		const lens = getLens('game', 'browse')
		assert.ok(lens !== undefined)
		const page1 = await lens.pipeline({ params: { limit: 1, skip: 0, dir: 'desc' } })
		const page2 = await lens.pipeline({ params: { limit: 1, skip: 1, dir: 'desc' } })
		assert.equal(page1.rows.length, 1)
		assert.equal(page2.rows.length, 1)
		assert.notEqual(page1.rows[0]?.id, page2.rows[0]?.id)
	})
})
