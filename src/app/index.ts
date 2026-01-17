// Verify that all environment secrets are set
import './utils/verifyEnvironmentSecrets.js'

// Use Sentry
import './utils/instrument.js'

import { createServer } from 'node:http'

import * as Sentry from '@sentry/node'
import MongoStore from 'connect-mongo'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import mongoose from 'mongoose'
import passport from 'passport'

import globalErrorHandler from './middleware/globalErrorHandler.js'
import microservicesRouter from './routes/microservices/codeRunners.js'
import serviceRoutes from './routes/service.js'
import authRouter from './routes/users/auth.js'
import gameRouter from './routes/users/games.js'
import submissionRouter from './routes/users/submissions.js'
import tournamentRouter from './routes/users/tournaments.js'
import userRouter from './routes/users/users.js'
import databaseConnector from './utils/databaseConnector.js'
import logger from './utils/logger.js'
import configurePassport from './utils/passportConfig.js'
import config from './utils/setupConfig.js'
import { initSocket } from './utils/socket.js'

// Environment variables
const { NODE_ENV, SESSION_SECRET } = process.env as Record<string, string>

// Config variables
const {
	expressPort,
	corsConfig,
	cookieOptions
} = config

// Destructuring and global variables
const app = express() // Create an Express application
const server = createServer(app) // Create an HTTP server

// Logging environment
logger.info(`Node environment: ${NODE_ENV}`)

// Trust proxy settings
app.set('trust proxy', 1) // Trust the first proxy (NGINX)

// Connect to MongoDB in production and staging environment
if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
	await databaseConnector.connectToMongoDB()
}

// Setup Socket.io
await initSocket(server)

// Middleware
app.use(helmet()) // Security headers
app.use(express.json()) // for parsing application/json
app.use(cookieParser()) // For parsing cookies

// Apply cors config to all routes
app.use(cors(corsConfig))

// Create a session store
const sessionStore = MongoStore.create({
	client: mongoose.connection.getClient(), // Use the existing connection
	autoRemove: 'interval', // Remove expired sessions
	autoRemoveInterval: 1 // 1 minute
})

// Create session middleware
const sessionMiddleware = session({ // Session management
	resave: true, // Save the updated session back to the store
	rolling: true, // Reset the cookie max-age on every request
	secret: SESSION_SECRET, // Secret for signing session ID cookie
	saveUninitialized: false, // Do not save session if not authenticated
	store: sessionStore, // Store session in MongoDB
	cookie: cookieOptions
})

// Apply session management middleware
app.use(sessionMiddleware)

// Apply and configure Passport middleware
app.use(passport.initialize()) // Initialize Passport
app.use(passport.session()) // Passport session handling
configurePassport(passport) // Use passportConfig

// Use all routes
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/submissions', submissionRouter)
app.use('/api/v1/users', userRouter)
app.use('/api/v1/tournaments', tournamentRouter)
app.use('/api/v1/games', gameRouter)
app.use('/api/v1/microservices', microservicesRouter)
app.use('/api/service', serviceRoutes)

// Sentry error handler
Sentry.setupExpressErrorHandler(app)

// Global error handler middleware
app.use(globalErrorHandler)

// Listen
server.listen(expressPort, () => {
	logger.info(`Express is listening at http://localhost:${expressPort}`)
})

// Handle unhandled rejections outside middleware
process.on('unhandledRejection', async (reason, promise): Promise<void> => {
	const errorMessage = reason instanceof Error ? reason.message : String(reason)
	logger.error(`Unhandled Rejection: ${errorMessage}`, { reason, promise })
	if (NODE_ENV !== 'test') {
		// eslint-disable-next-line n/no-process-exit
		process.exit(1) // Exit the process with failure code
	}
})

// Handle uncaught exceptions outside middleware
process.on('uncaughtException', async (err): Promise<void> => {
	logger.error('Uncaught exception', { error: err })
	if (NODE_ENV !== 'test') {
		// eslint-disable-next-line n/no-process-exit
		process.exit(1) // Exit the process with failure code
	}
})

// Shutdown function
export async function shutDown (): Promise<void> {
	logger.info('Closing server...')
	server.close()
	logger.info('Server closed')

	logger.info('Closing session store...')
	await sessionStore.close()
	logger.info('Session store closed')

	logger.info('Closing database connection...')
	await mongoose.connection.close()
	logger.info('Database connection closed')

	logger.info('Shutdown completed')
}

export { server, sessionStore }
export default app
