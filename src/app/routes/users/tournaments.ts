// Node.js built-in modules
// Third-party libraries
// Own modules
// Environment variables
// Config variables
// Destructuring and global variables

import Router from 'express'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'
import { isAuthenticated } from '../../middleware/authorization.js'
import {
	getAllTournaments,
	getTournament,
	getTournamentGradings
} from '../../controllers/users/tournamentController.js'

const router = Router()

/**
 * @route GET /api/v1/tournaments
 * @description Get all tournaments with optional filtering
 * @access Private
 */
router.get('/',
	isAuthenticated,
	asyncErrorHandler(getAllTournaments)
)

/**
 * @route GET /api/v1/tournaments/:id
 * @description Get a specific tournament
 */
router.get('/:id',
	asyncErrorHandler(getTournament)
)

/**
 * @route GET /api/v1/tournaments/:id/gradings
 * @description Get all gradings for a tournament
 */
router.get('/:id/gradings',
	asyncErrorHandler(getTournamentGradings)
)

export default router
