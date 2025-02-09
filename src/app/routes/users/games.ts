// Node.js built-in modules

// Third-party libraries

import Router from 'express'

// Own modules
import {
	getAllGames,
	getGame,
} from '../../controllers/users/gameController.js'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'

// Environment variables

// Config variables

// Destructuring and global variables
const router = Router()

/**
 * @route GET /api/v1/games
 * @description Get all games
 * @access Public
 * @returns {number} res.status - HTTP status code
 * @returns {Array<{
 *   _id: string,
 *   name: string,
 *   description: string,
 *   files: {[key: string]: string},
 *   batchSize: number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }>} res.body - Array of games
 */
router.get('/',
	asyncErrorHandler(getAllGames)
)

/**
 * @route GET /api/v1/games/:id
 * @description Get a game by id
 * @access Public
 * @param {string} req.params.id - Game ID
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   _id: string,
 *   name: string,
 *   description: string,
 *   files: {[key: string]: string},
 *   batchSize: number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }|{error: string}} res.body - Game object or error message
 */
router.get('/:id',
	asyncErrorHandler(getGame)
)

export default router
