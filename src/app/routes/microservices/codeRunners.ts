// Node.js built-in modules

// Third-party libraries
import { Router } from 'express'

// Own modules
import {
	getActiveSubmissions,
	saveGradingsWithTournament,
	getGames
} from '../../controllers/microservices/codeRunnerController.js'
import { authenticateMicroservice } from '../../middleware/auth.js'

// Environment variables

// Config variables

// Destructuring and global variables
const router = Router()

// Apply microservice authentication to all routes
router.use(authenticateMicroservice)

/**
 * @route GET api/v1/microservices/submissions
 * @description Get all active submissions
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @returns {number} res.status - HTTP status code
 * @returns {Array<Object>} res.body - Array of active submissions
 */
router.get('/submissions',
	authenticateMicroservice,
	getActiveSubmissions
)

/**
 * @route GET api/v1/microservices/games
 * @description Get all games
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @returns {number} res.status - HTTP status code
 * @returns {Array<Object>} res.body - Array of games
 */
router.get('/games',
	authenticateMicroservice,
	getGames
)

/**
 * @route POST api/v1/microservices/tournament
 * @description Create multiple gradings and associated tournament
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @param {Array<{ submission: string, score: number, avgExecutionTime: number; }>} req.body.gradings - Array of gradings to create
 * @param {Array<{ submission: string, reason: string }>} req.body.disqualified - Array of submissions that were disqualified
 * @param {string} req.body.tournamentExecutionTime - Time taken to execute the tournament
 * @param {string} req.body.game - ID of the game for the tournament
 * @returns {number} res.status - HTTP status code
 * @returns {Object} res.body - New gradings and tournament
 */
router.post('/tournament', 
	authenticateMicroservice,
	saveGradingsWithTournament
)

export default router
