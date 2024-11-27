// Node.js built-in modules

// Third-party libraries

import Router from 'express'

// Own modules
import {
	getAllTournaments,
	getTournament,
	getTournamentGradings
} from '../../controllers/users/tournamentController.js'
import { isAuthenticated } from '../../middleware/auth.js'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'

// Environment variables

// Config variables

// Destructuring and global variables
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
