// Node.js built-in modules

// Third-party libraries
import Router from 'express'

// Own modules
import {
	createSubmission,
	getSubmissions,
	updateSubmission,
	getSubmission,
	requestTestGrading,
	getSubmissionGradings
} from '../../controllers/users/submissionController.js'
import { isAuthenticated } from '../../middleware/authorization.js'
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
	isAuthenticated,
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
router.post('/:id/test',
	asyncErrorHandler(requestTestGrading)
)

/**
 * @route GET /api/v1/submissions/:id/gradings
 * @description Get all gradings for a submission
 */
router.get('/:id/gradings',
	asyncErrorHandler(getSubmissionGradings)
)

export default router
