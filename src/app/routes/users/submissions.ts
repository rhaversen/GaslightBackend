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
 */
router.get('/',
	asyncErrorHandler(getSubmissions)
)

/**
 * @route PATCH /api/v1/submissions/:id
 * @description Update a specific submission
 */
router.patch('/:id',
	asyncErrorHandler(updateSubmission)
)

/**
 * @route GET /api/v1/submissions/:id
 * @description Get a specific submission
 */
router.get('/:id',
	asyncErrorHandler(getSubmission)
)

/**
 * @route POST /api/v1/submissions/:id/test
 * @description Request test grading for a submission
 */
router.post('/:id/evaluate',
	asyncErrorHandler(evaluateSubmission)
)

export default router
