import { Router } from 'express'

import {
	getAllGames,
	getGame
} from '../../controllers/users/gameController.js'

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
	getAllGames
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
	getGame
)

export default router
