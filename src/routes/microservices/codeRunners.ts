import { Router } from 'express'

import {
	getActiveSubmissions,
	saveGradingsWithTournament,
	getGames
} from '../../controllers/microservices/codeRunnerController.js'
import { authenticateMicroservice } from '../../middleware/auth.js'

const router = Router()

// Apply microservice authentication to all routes
router.use(authenticateMicroservice)

/**
 * @route GET api/v1/microservices/submissions
 * @description Get all active submissions
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice
 * @param {string} [req.query.excludeUser] - Optional user ID to exclude from results
 * @param {string} [req.query.game] - Optional game ID to filter submissions
 * @returns {number} res.status - HTTP status code
 * @returns {Array<{submissionId: string, files: {[key: string]: string}}>} res.body - Array of active submissions
 */
router.get('/submissions',
	authenticateMicroservice,
	getActiveSubmissions
)

/**
 * @route GET api/v1/microservices/games
 * @description Get all games
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice
 * @returns {number} res.status - HTTP status code
 * @returns {Array<{id: string, gameFiles: {[key: string]: string}, batchSize: number}>} res.body - Array of games
 */
router.get('/games',
	authenticateMicroservice,
	getGames
)

/**
 * @route POST api/v1/microservices/tournament
 * @description Create multiple gradings and associated tournament
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice
 * @param {Array<{submission: string, score: number, avgExecutionTime: number}>} req.body.gradings - Array of gradings to create
 * @param {Array<{submission: string, reason: string}>} req.body.disqualified - Array of disqualified submissions
 * @param {number} req.body.tournamentExecutionTime - Time taken to execute the tournament in milliseconds
 * @param {string} req.body.game - ID of the game for the tournament
 * @returns {number} res.status - HTTP status code
 * @returns {{tournamentId: string}} res.body - ID of the created tournament
 */
router.post('/tournament',
	authenticateMicroservice,
	saveGradingsWithTournament
)

export default router
