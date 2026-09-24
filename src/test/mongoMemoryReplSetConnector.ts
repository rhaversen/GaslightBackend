import type MongoStore from 'connect-mongo'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'

import logger from '../utils/logger.js'
import config from '../utils/setupConfig.js'

const { mongooseOpts } = config
let replSet: MongoMemoryReplSet

export default async function connectToInMemoryMongoDB (): Promise<void> {
	logger.info('Attempting connection to in-memory MongoDB')

	try {
		replSet = new MongoMemoryReplSet()

		await replSet.start()
		await replSet.waitUntilRunning()
		const mongoUri = replSet.getUri()
		await mongoose.connect(mongoUri, mongooseOpts)
		logger.info('Connected to in-memory MongoDB')
	} catch (error) {
		logger.error(`Error connecting to in-memory MongoDB: ${error instanceof Error ? error.message : String(error)}`)
		throw error
	}
}

function closeSessionStore (sessionStore: MongoStore): void {
	// Clear the interval timer used by connect-mongo. The timer handle lives on
	// an internal property that has no public type surface.
	const cleanupTimer = (sessionStore as unknown as { _removeExpiredSessions?: NodeJS.Timeout })._removeExpiredSessions
	if (cleanupTimer !== undefined) {
		clearInterval(cleanupTimer)
	}
}

export async function disconnectFromInMemoryMongoDB (sessionStore?: MongoStore): Promise<void> {
	try {
		if (sessionStore !== undefined) {
			logger.info('Closing session store...')
			closeSessionStore(sessionStore)
			logger.info('Session store closed')
		}

		logger.info('Closing connection to in-memory MongoDB...')
		await mongoose.disconnect()
		logger.info('Mongoose disconnected')

		logger.info('Stopping memory database replica set...')
		await replSet.stop({ force: true })
		logger.info('Memory database replica set stopped')
	} catch (error) {
		logger.error(`Error disconnecting from in-memory MongoDB: ${error instanceof Error ? error.message : String(error)}`)
	}
}
