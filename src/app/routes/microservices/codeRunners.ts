// Node.js built-in modules

// Third-party libraries
import { Router } from 'express'

// Own modules
import {
	getActiveSubmissions,
	createGrading,
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
router.get('/submissions', getActiveSubmissions)

/**
 * @route POST api/v1/microservices/grading
 * @description Create a grading
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @param {string} req.body.submission - Submission ID
 * @param {number} req.body.score - Grading score
 * @returns {number} res.status - HTTP status code
 * @returns {Object} res.body - New grading
 */
router.post('/grading', createGrading)

/**
 * @route POST api/v1/microservices/gradings
 * @description Create multiple gradings
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @param {Array<Record<string, number>>} req.body.gradings - Array of gradings
 * @returns {number} res.status - HTTP status code
 * @returns {Array<Object>} res.body - New gradings
 */
router.post('/gradings', createGradings)

/**
 * @route POST api/v1/microservices/tournaments
 * @description Create a tournament
 * @access Private (Microservice)
 * @param {string} req.header.authorization - The secret key for the microservice.
 * @param {Array<string>} req.body.gradings - Array of grading IDs
 * @returns {number} res.status - HTTP status code
 * @returns {Object} res.body - New tournament
 */
router.post('/tournaments', createTournament)

export default router
