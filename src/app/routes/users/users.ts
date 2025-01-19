// Node.js built-in modules

// Third-party libraries
import Router from 'express'

// Own modules
import {
	register
} from '../../controllers/users/userController.js'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'

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

export default router
