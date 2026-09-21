import mongoose from 'mongoose'

import logger from './logger.js'
import config from './setupConfig.js'

const {
	mongooseOpts,
	maxRetryAttempts,
	retryInterval,
	retryWrites,
	w,
	appName
} = config

const mongoUri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=${retryWrites}&w=${w}&appName=${appName}`

function isMemoryDatabase (): boolean {
	return mongoose.connection.host === '127.0.0.1'
}

async function connectToMongoDB (): Promise<void> {
	if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') { return }

	for (let currentRetryAttempt = 0; currentRetryAttempt < maxRetryAttempts; currentRetryAttempt++) {
		logger.info('Attempting connection to MongoDB')

		try {
			await mongoose.connect(mongoUri, mongooseOpts)
			logger.info('Connected to MongoDB')
			return // Successfully connected
		} catch (error) {
			logger.error('Error connecting to MongoDB', { error })
			await new Promise(resolve => setTimeout(resolve, retryInterval))
		}
	}

	// Exhausted retries — exit non-zero so the orchestrator restarts the pod
	logger.error(`Failed to connect to MongoDB after ${maxRetryAttempts} attempts. Shutting down.`)
	// eslint-disable-next-line n/no-process-exit
	process.exit(1)
}

const databaseConnector = {
	isMemoryDatabase,
	connectToMongoDB
}

export default databaseConnector
