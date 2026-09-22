import { Router } from 'express'

import {
	getAllGames,
	getGame,
	createGame
} from '../../controllers/users/gameController.js'
import { ensureAuthenticated } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

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
 *   summary: string,
 *   files: {[key: string]: string},
 * 	 apiType: string
 *   exampleStrategy: string
 *   batchSize: number,
 * 	 submissionCount: number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }>} res.body - Array of games
 */
router.get('/',
	asyncHandler(getAllGames)
)

/**
 * @route POST /api/v1/games
 * @description Submit a new user-created game. Immediately usable, no approval flow.
 * @access Private
 * @param {string} req.body.name - Game name (1-100 chars)
 * @param {string} req.body.summary - Short summary (max 100 chars)
 * @param {string} req.body.description - Long description (max 5000 chars)
 * @param {Object} req.body.files - Game files map, must include main.ts (10k chars each)
 * @param {string} req.body.apiType - API type of the game
 * @param {string} req.body.exampleStrategy - Example strategy source (max 10k chars)
 * @param {number} req.body.batchSize - Players per match (1-20)
 * @returns {number} res.status - HTTP status code
 * @returns {Object} res.body - Created game
 */
router.post('/',
	ensureAuthenticated,
	asyncHandler(createGame)
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
 *   summary: string,
 *   files: {[key: string]: string},
 * 	 apiType: string
 *   exampleStrategy: string,
 *   batchSize: number,
 * 	 submissionCount: number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }|{error: string}} res.body - Game object or error message
 */
router.get('/:id',
	asyncHandler(getGame)
)

export default router
