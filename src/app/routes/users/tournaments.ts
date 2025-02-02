// Node.js built-in modules

// Third-party libraries

import Router from 'express'

// Own modules
import {
	getAllTournaments,
	getTournament,
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
 * @query {string} [fromDate] - Filter tournaments from this date
 * @query {string} [toDate] - Filter tournaments until this date
 * @query {number} [limit] - Limit number of tournaments returned
 * @query {number} [skip] - Number of tournaments to skip
 * @query {number} [limitStandings] - Limit number of standings per tournament
 * @query {number} [skipStandings] - Number of standings to skip
 * @query {string} [userIdStanding] - Get specific user standing
 * @query {string} [sortFieldStandings] - Field to sort standings by
 * @query {string} [sortDirectionStandings] - Sort direction (1 for ascending, -1 for descending)
 */
router.get('/',
	asyncErrorHandler(getAllTournaments)
)

/**
 * @route GET /api/v1/tournaments/:id
 * @description Get a specific tournament
 * @access Public
 * @param {string} id - Tournament ID
 * @query {boolean} [getStandings] - Whether to include standings in response
 * @query {number} [limitStandings] - Limit number of standings returned (default: 30)
 * @query {number} [skipStandings] - Number of standings to skip (default: 0)
 * @query {string} [userIdStanding] - Get specific user standing
 * @query {string} [sortFieldStandings] - Field to sort standings by (default: 'score')
 * @query {string} [sortDirectionStandings] - Sort direction (1 for ascending, -1 for descending)
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
 * @route GET /api/v1/tournaments/:id/standings
 * @description Get standings for a tournament
 * @access Public
 * @param {string} id - Tournament ID
 * @query {number} [limitStandings] - Limit number of standings returned (default: 30)
 * @query {number} [skipStandings] - Number of standings to skip (default: 0)
 * @query {string} [sortFieldStandings] - Field to sort standings by (default: 'score')
 * @query {string} [sortDirectionStandings] - Sort direction (1 for ascending, -1 for descending)
 */
router.get('/:id/standings',
	asyncErrorHandler(getTournamentStandings)
)

export default router
