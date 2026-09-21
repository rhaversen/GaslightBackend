import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import mongoose from 'mongoose'

import GameModel from '../models/Game.js'
import UserModel from '../models/User.js'

import connectToInMemoryMongoDB, { disconnectFromInMemoryMongoDB } from './mongoMemoryReplSetConnector.js'

// Smoke test: models and schema hooks behave on a real (in-memory) Mongo.
// Runs against an isolated repl set, no app server, no network services.

describe('models', () => {
	before(async () => {
		await connectToInMemoryMongoDB()
	})

	after(async () => {
		await disconnectFromInMemoryMongoDB()
	})

	it('creates a user and stores a hashed password', async () => {
		const password = 'correct-horse-battery-staple'
		const user = await UserModel.create({
			email: 'smoke@test.dev',
			password
		})

		assert.ok(user.id.length > 0)
		assert.notEqual(user.password, password, 'password must not be stored in plain text')
		const isMatch = await user.comparePassword(password)
		assert.equal(isMatch, true)
	})

	it('rejects a duplicate user email', async () => {
		await assert.rejects(
			() => UserModel.create({ email: 'smoke@test.dev', password: 'x' })
		)
	})

	it('creates a game with files map and example strategy', async () => {
		const game = await GameModel.create({
			name: 'Smoke Game',
			summary: 'A game created by the smoke test',
			description: 'Longer description of the smoke test game',
			files: { 'main.ts': 'export const Game = {}' },
			apiType: 'turnBased',
			exampleStrategy: 'export const strategy = () => {}',
			batchSize: 2
		})

		assert.equal(game.name, 'Smoke Game')
		assert.equal(game.batchSize, 2)

		const found = await GameModel.findById(game._id)
		assert.ok(found !== null)
		assert.equal(found.id, game.id)
	})

	it('connects to an in-memory replica set', () => {
		assert.equal(mongoose.connection.readyState, 1)
	})
})
