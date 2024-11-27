// Verify that all environment secrets are set
import './utils/verifyEnvironmentSecrets.js'

// Use Sentry
import './utils/instrument.js'

// Node.js built-in modules
import { createServer } from 'node:http'

// Third-party libraries
import * as Sentry from '@sentry/node'
import MongoStore from 'connect-mongo'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import mongoSanitize from 'express-mongo-sanitize'
import session from 'express-session'
import helmet from 'helmet'
import mongoose from 'mongoose'
import passport from 'passport'

// Own modules
import globalErrorHandler from './middleware/globalErrorHandler.js'
import microservicesRouter from './routes/microservices/codeRunners.js'
import serviceRoutes from './routes/service.js'
import authRouter from './routes/users/auth.js'
import submissionRouter from './routes/users/submissions.js'
import tournamentRouter from './routes/users/tournaments.js'
import userRouter from './routes/users/users.js'
import databaseConnector from './utils/databaseConnector.js'
import logger from './utils/logger.js'
import configurePassport from './utils/passportConfig.js'
import config from './utils/setupConfig.js'
import { initSocket } from './utils/socket.js'

// Environment variables
const { NODE_ENV } = process.env as Record<string, string>

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

// Setup
await initSocket(server) // Initialize socket.io
app.set('trust proxy', 1) // Trust the first proxy (NGINX)

// Connect to MongoDB in production and staging environment
if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
	await databaseConnector.connectToMongoDB()
}

// Middleware
app.use(helmet()) // Security headers
app.use(express.json()) // for parsing application/json
app.use(cookieParser()) // For parsing cookies
app.use(mongoSanitize()) // Data sanitization against NoSQL query injection

// Apply cors config to all other routes
app.use(cors(corsConfig))

// Create a session store
const sessionStore = MongoStore.create({
	client: mongoose.connection.getClient() as any, // Use the existing connection
	autoRemove: 'interval', // Remove expired sessions
	autoRemoveInterval: 1 // 1 minute
})

// Apply session management middleware
app.use(session({ // Session management
	resave: true, // Save the updated session back to the store
	rolling: true, // Reset the cookie max-age on every request
	secret: process.env.SESSION_SECRET ?? '', // Secret for signing session ID cookie
	saveUninitialized: false, // Do not save session if not authenticated
	store: sessionStore, // Store session in MongoDB
	cookie: cookieOptions
}))

// Apply and configure Passport middleware
app.use(passport.initialize()) // Initialize Passport
app.use(passport.session()) // Passport session handling
configurePassport(passport) // Use passportConfig

// Use all routes
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/submissions', submissionRouter)
app.use('/api/v1/users', userRouter)
app.use('/api/v1/tournaments', tournamentRouter)
app.use('/api/v1/microservices', microservicesRouter)
app.use('/api/v1/service', serviceRoutes)

// Sentry error handler
Sentry.setupExpressErrorHandler(app)

// Global error handler middleware
app.use(globalErrorHandler)

// Listen
server.listen(expressPort, () => {
	logger.info(`Express is listening at http://localhost:${expressPort}`)
})

// Handle unhandled rejections outside middleware
process.on('unhandledRejection', (reason, promise): void => {
	// Attempt to get a string representation of the promise
	const promiseString = JSON.stringify(promise) !== '' ? JSON.stringify(promise) : 'a promise'

	// Get a detailed string representation of the reason
	const reasonDetail = reason instanceof Error ? reason.stack ?? reason.message : JSON.stringify(reason)

	// Log the detailed error message
	logger.error(`Unhandled Rejection at: ${promiseString}, reason: ${reasonDetail}`)

	shutDown().catch(error => {
		// If 'error' is an Error object, log its stack trace; otherwise, convert to string
		const errorDetail = error instanceof Error ? error.stack ?? error.message : String(error)
		logger.error(`An error occurred during shutdown: ${errorDetail}`)
		process.exit(1)
	})
})

// Handle uncaught exceptions outside middleware
process.on('uncaughtException', (err): void => {
	logger.error('Uncaught exception:', err)
	shutDown().catch(error => {
		logger.error('An error occurred during shutdown:', error)
		process.exit(1)
	})
})

// Shutdown function
export async function shutDown (): Promise<void> {
	logger.info('Closing server...')
	server.close()
	logger.info('Server closed')
	logger.info('Closing database connection...')
	await mongoose.connection.close()
	logger.info('Database connection closed')

	logger.info('Shutdown completed')
}

export { server, sessionStore }
export default app
