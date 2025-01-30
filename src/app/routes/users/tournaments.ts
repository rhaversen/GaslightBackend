// Node.js built-in modules

// Third-party libraries

import Router from 'express'

// Own modules
import {
	getAllTournaments,
	getTournament,
	getTournamentGradings,
	getTournamentStatistics,
	getTournamentStandings
} from '../../controllers/users/tournamentController.js'
import asyncErrorHandler from '../../utils/asyncErrorHandler.js'

// Environment variables

// Config variables

// Destructuring and global variables
const router = Router()

/**
 * @route GET /api/v1/tournaments
 * @description Get all tournaments with optional filtering
 * @access Public
 */
router.get('/',
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
 * @route GET /api/v1/tournaments/:id/statistics
 * @description Get statistics for a tournament
 */
router.get('/:id/statistics',
	asyncErrorHandler(getTournamentStatistics)
)

/**
 * @route GET /api/v1/tournaments/:id/gradings
 * @description Get all gradings for a tournament
 */
router.get('/:id/gradings',
	asyncErrorHandler(getTournamentGradings)
)

/**
 * @route GET /api/v1/tournaments/:id/standings
 * @description Get standings for a tournament with optional amount parameter
 */
router.get('/:id/standings',
	asyncErrorHandler(getTournamentStandings)
)

export default router
