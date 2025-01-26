// Node.js built-in modules

// Third-party libraries
import Router from 'express'

// Own modules
import {
	register,
	getAllUsers,
	getUser,
	updateUser
} from '../../controllers/users/userController.js'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'
import { ensureAuthenticated } from '../../middleware/auth.js'

// Environment variables

// Config variables

// Destructuring and global variables
const router = Router()

/**
 * @route POST /api/v1/users
 * @description Register user, login and return session cookie.
 * @access Public
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {string} req.body.confirmPassword - The password confirmation of the user.
 * @returns {number} res.status - The status code of the HTTP response.
 * @returns {Object} res.body - The user object.
 * @returns {string} res.headers['set-cookie'] - The session cookie.
 */
router.post('/',
	asyncErrorHandler(register)
)

/**
 * @route GET /api/v1/users
 * @description Get all users.
 * @access Public
 * @returns {number} res.status - The status code of the HTTP response.
 * @returns {Object} res.body - The user object.
 */
router.get('/',
	asyncErrorHandler(getAllUsers)
)

/**
 * @route GET /api/v1/users/[id]
 * @description Get single user by ID.
 * @access Public
 * @param {string} req.params.id - The ID of the user.
 * @returns {number} res.status - The status code of the HTTP response.
 * @returns {Object} res.body - The user object.
 */
router.get('/:id',
	asyncErrorHandler(getUser)
)

/**
 * @route PATCH /api/v1/users/[id]
 * @description Update user by ID.
 * @access Private
 * @param {string} req.params.id - The ID of the user.
 * @param {string} [req.body.username] - The username of the user.
 * @param {string} [req.body.email] - The email of the user.
 * @param {string} [req.body.password] - The password of the user.
 * @param {string} [req.body.confirmPassword] - The password confirmation of the user.
 * @returns {number} res.status - The status code of the HTTP response.
 * @returns {Object} res.body - The user object.
 */
router.patch('/:id',
	ensureAuthenticated,
	asyncErrorHandler(updateUser)
)

export default router
