// Node.js built-in modules

// Third-party libraries
import Router from 'express'

// Own modules
import {
	createSubmission,
	getSubmissions,
	updateSubmission,
	getSubmission,
	deleteSubmission,
	reEvaluateSubmission
} from '../../controllers/users/submissionController.js'
import { ensureAuthenticated } from '../../middleware/auth.js'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'

// Environment variables

// Config variables

// Destructuring and global variables
const router = Router()

/**
 * @route POST /api/v1/submissions
 * @description Create a new submission
 * @access Private
 * @param {string} req.body.code - Submission code
 * @param {string} req.body.title - Submission title
 * @param {string} req.body.game - Game ID
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   _id: string,
 *   title: string,
 *   code: string,
 *   game: string,
 *   user: string,
 *   active: boolean,
 *   passedEvaluation: boolean,
 *   evaluationError: string|null,
 *   tokenCount: number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }|{error: string}} res.body - Created submission or error message
 */
router.post('/',
	ensureAuthenticated,
	asyncErrorHandler(createSubmission)
)

/**
 * @route GET /api/v1/submissions
 * @description Get all submissions for authenticated user
 * @access Public
 * @param {string} [req.query.game] - Filter by game ID
 * @param {boolean} [req.query.active] - Filter by active status
 * @param {boolean} [req.query.passedEvaluation] - Filter by passed evaluation status
 * @param {string} [req.query.user] - Filter by user ID
 * @param {number} [req.query.maxAmount] - Limit number of submissions returned
 * @param {number} [req.query.startIndex] - Number of submissions to skip
 * @returns {number} res.status - HTTP status code
 * @returns {Array<{
 *   _id: string,
 *   title: string,
 *   code: string,
 *   game: string,
 *   user: string,
 *   active: boolean,
 *   passedEvaluation: boolean,
 *   evaluationError: string|null,
 *   tokenCount: number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }>} res.body - Array of submissions
 */
router.get('/',
	asyncErrorHandler(getSubmissions)
)

/**
 * @route PATCH /api/v1/submissions/:id
 * @description Update a specific submission and re-evaluate it
 * @access Private
 * @param {string} req.params.id - Submission ID
 * @param {string} [req.body.code] - New submission code
 * @param {string} [req.body.title] - New submission title
 * @param {boolean} [req.body.active] - New active status
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   _id: string,
 *   title: string,
 *   code: string,
 *   game: string,
 *   user: string,
 *   active: boolean,
 *   passedEvaluation: boolean,
 *   evaluationError: string|null,
 *   tokenCount: number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }|{error: string}} res.body - Updated submission or error message
 */
router.patch('/:id',
	ensureAuthenticated,
	asyncErrorHandler(updateSubmission)
)

/**
 * @route GET /api/v1/submissions/:id
 * @description Get a specific submission
 * @access Public
 * @param {string} req.params.id - Submission ID
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   _id: string,
 *   title: string,
 *   code: string,
 *   game: string,
 *   user: string,
 *   active: boolean,
 *   passedEvaluation: boolean,
 *   evaluationError: string|null,
 *   tokenCount: number,
 *   createdAt: Date,
 *   updatedAt: Date,
 *   gradings?: Array<{score: number, tournament: string, placement: number, percentileRank: number}>
 * }|{error: string}} res.body - Submission with optional gradings or error message
 */
router.get('/:id',
	asyncErrorHandler(getSubmission)
)

/**
 * @route DELETE /api/v1/submissions/:id
 * @description Delete a specific submission
 * @access Private
 * @param {string} req.params.id - Submission ID
 * @returns {number} res.status - HTTP status code
 * @returns {{message: string}|{error: string}} res.body - Success message or error message
 */
router.delete('/:id',
	ensureAuthenticated,
	asyncErrorHandler(deleteSubmission)
)

/**
 * @route POST /api/v1/submissions/:id/evaluate
 * @description Re-evaluate a specific submission
 * @access Private
 */
router.post('/:id/evaluate',
	ensureAuthenticated,
	asyncErrorHandler(reEvaluateSubmission)
)

export default router
