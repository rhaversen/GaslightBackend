// Node.js built-in modules

// Third-party libraries
import Router from 'express'

// Own modules
import {
	register,
	getAllUsers,
	getUser,
	updateUser,
} from '../../controllers/users/userController.js'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'
import { ensureAuthenticated } from '../../middleware/auth.js'

// Environment variables

// Config variables

// Destructuring and global variables
const router = Router()

/**
 * @route POST /api/v1/users
 * @description Register user, login and return session cookie
 * @access Public
 * @param {string} req.body.email - User's email
 * @param {string} req.body.password - User's password
 * @param {string} req.body.confirmPassword - Password confirmation
 * @returns {number} res.status - HTTP status code
 * @returns {{auth: boolean, error?: string}} res.body - Authentication status and optional error message
 * @returns {string} res.headers['set-cookie'] - Session cookie
 */
router.post('/',
	asyncErrorHandler(register)
)

/**
 * @route GET /api/v1/users
 * @description Get all users
 * @access Public
 * @returns {number} res.status - HTTP status code
 * @returns {Array<{
 *   _id: string,
 *   username: string,
 *   email: string|null,
 *   expirationDate: Date|null,
 *   confirmed: boolean|null,
 *   submissionCount: number,
 *   activeSubmission: string|null,
 *   createdAt: Date,
 *   updatedAt: Date
 * }>} res.body - Array of user objects with sensitive data only included for requesting user
 */
router.get('/',
	asyncErrorHandler(getAllUsers)
)

/**
 * @route GET /api/v1/users/:id
 * @description Get single user by ID
 * @access Public
 * @param {string} req.params.id - User ID
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   _id: string,
 *   username: string,
 *   email: string|null,
 *   expirationDate: Date|null,
 *   confirmed: boolean|null,
 *   submissionCount: number,
 *   activeSubmission: string|null,
 *   createdAt: Date,
 *   updatedAt: Date
 * }|{error: string}} res.body - User object with sensitive data only included for requesting user, or error
 */
router.get('/:id',
	asyncErrorHandler(getUser)
)

/**
 * @route PATCH /api/v1/users/:id
 * @description Update user by ID
 * @access Private
 * @param {string} req.params.id - User ID
 * @param {string} [req.body.username] - New username
 * @param {string} [req.body.email] - New email
 * @param {string} [req.body.password] - New password
 * @param {string} [req.body.confirmPassword] - New password confirmation
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   _id: string,
 *   username: string,
 *   email: string,
 *   expirationDate: Date,
 *   confirmed: boolean,
 *   submissionCount: number,
 *   activeSubmission: string|null,
 *   createdAt: Date,
 *   updatedAt: Date
 * }|{error: string}} res.body - Updated user object or error message
 */
router.patch('/:id',
	ensureAuthenticated,
	asyncErrorHandler(updateUser)
)

export default router
