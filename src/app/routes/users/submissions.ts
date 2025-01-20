// Node.js built-in modules

// Third-party libraries
import Router from 'express'

// Own modules
import {
	createSubmission,
	getSubmissions,
	updateSubmission,
	getSubmission,
	evaluateSubmission,
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
 */
router.post('/',
	ensureAuthenticated,
	asyncErrorHandler(createSubmission)
)

/**
 * @route GET /api/v1/submissions
 * @description Get all submissions
 * @access Public
 */
router.get('/',
	asyncErrorHandler(getSubmissions)
)

/**
 * @route PATCH /api/v1/submissions/:id
 * @description Update a specific submission
 * @access Private
 */
router.patch('/:id',
	ensureAuthenticated,
	asyncErrorHandler(updateSubmission)
)

/**
 * @route GET /api/v1/submissions/:id
 * @description Get a specific submission
 * @access Private
 */
router.get('/:id',
	ensureAuthenticated,
	asyncErrorHandler(getSubmission)
)

/**
 * @route POST /api/v1/submissions/:id/evaluate
 * @description Request test grading for a submission
 * @access Private
 */
router.post('/:id/evaluate',
	ensureAuthenticated,
	asyncErrorHandler(evaluateSubmission)
)

export default router
