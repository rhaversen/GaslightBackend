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
*/
router.get('/',
	asyncErrorHandler(getAllGames)
)

/**
 * @route GET /api/v1/games/:id
 * @description Get a game by id
 * @access Public
*/
router.get('/:id',
	asyncErrorHandler(getGame)
)

export default router
