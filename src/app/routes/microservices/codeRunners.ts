// Node.js built-in modules

// Third-party libraries
import { Router } from 'express'

// Own modules
import {
	getActiveSubmissions,
	saveGradingsWithTournament,
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
 * @route POST api/v1/microservices/tournament
 * @description Create multiple gradings and associated tournament
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @param {Array<{submission: string, score: number}>} req.body.gradings - Array of gradings with submission IDs and scores
 * @param {Array<string>} [req.body.disqualified] - Array of submission IDs that were disqualified
 * @returns {number} res.status - HTTP status code
 * @returns {Object} res.body - New gradings and tournament
 */
router.post('/tournament', 
	authenticateMicroservice,
	saveGradingsWithTournament
)

export default router
