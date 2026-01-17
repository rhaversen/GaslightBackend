import { Router } from 'express'

import {
	loginUserLocal,
	logoutLocal,
	getMe
} from '../../controllers/users/authController.js'
import { ensureAuthenticated } from '../../middleware/auth.js'

const router = Router()

/**
 * @route POST /api/v1/auth/login-user-local
 * @description Login user and return session cookie.
 * @access Public
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @returns {number} res.status - The status code of the HTTP response.
 * @returns {Object} res.body - The user object.
 * @returns {string} res.headers['set-cookie'] - The session cookie.
 */
router.post('/login-user-local',
	loginUserLocal
)

/**
 * @route POST /api/v1/auth/logout-local
 * @description Logout user and clear session cookie.
 * @access Private
 * @returns {number} res.status - The status code of the HTTP response.
 */
router.post('/logout-local',
	logoutLocal
)

/**
 * @route GET /api/v1/auth/user
 * @description Get current user.
 * @access Private
 * @returns {number} res.status - The status code of the HTTP response.
 * @returns {Object} res.body - The user object.
 */
router.get('/user',
	ensureAuthenticated,
	getMe
)

/**
 * @route GET /api/v1/auth/is-authenticated
 * @description Check if user is authenticated.
 * @access Private
 * @returns {number} res.status - The status code of the HTTP response.
 */
router.get('/is-authenticated',
	ensureAuthenticated,
	(req, res) => {
		// If user is authenticated, return 200 OK and session ID
		res.status(200).send(req.sessionID)
	}
)

export default router
