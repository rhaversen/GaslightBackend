// Node.js built-in modules

// Third-party libraries
import { Router } from 'express'

// Own modules
import {
	getActiveSubmissions,
	createTournament,
	createGradings,
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
 * @route POST api/v1/microservices/gradings
 * @description Create multiple gradings
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @param {Array<Record<string, number>>} req.body.gradings - Array of gradings
 * @returns {number} res.status - HTTP status code
 * @returns {Array<Object>} res.body - New gradings
 */
router.post('/gradings', 
	authenticateMicroservice,
	createGradings
)

/**
 * @route POST api/v1/microservices/tournaments
 * @description Create a tournament
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @param {Array<string>} req.body.gradings - Array of grading IDs
 * @returns {number} res.status - HTTP status code
 * @returns {Object} res.body - New tournament
 */
router.post('/tournaments',
	authenticateMicroservice,
	createTournament
)

export default router
