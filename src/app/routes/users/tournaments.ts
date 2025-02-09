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
 * @param {string} [req.query.fromDate] - Filter tournaments from this date
 * @param {string} [req.query.toDate] - Filter tournaments until this date
 * @param {number} [req.query.limit] - Limit number of tournaments returned
 * @param {number} [req.query.skip] - Number of tournaments to skip
 * @param {boolean} [req.query.getStandings] - Whether to include standings
 * @param {string} [req.query.includesUser] - Filter tournaments to include only those with gradings for the specified user
 * @param {string} [req.query.game] - Filter tournaments by game ID
 * @param {number} [req.query.limitStandings] - Limit number of standings per tournament (default: 3)
 * @param {number} [req.query.skipStandings] - Number of standings to skip
 * @param {string} [req.query.userIdStanding] - Get specific user standing
 * @param {string} [req.query.sortFieldStandings] - Field to sort standings by (default: 'score')
 * @param {SortOrder} [req.query.sortDirectionStandings] - Sort direction (1 or -1)
 * @returns {number} res.status - HTTP status code
 * @returns {Array<{
 *   _id: string,
 *   disqualified: Array<{submission: string, reason: string}>,
 *   submissionCount: number,
 *   tournamentExecutionTime: number,
 *   game: string,
 *   standings?: Array<TournamentStanding>,
 *   userStanding?: TournamentStanding|null,
 *   createdAt: Date,
 *   updatedAt: Date
 * }>} res.body - Array of tournaments
 */
router.get('/',
	asyncErrorHandler(getAllTournaments)
)

/**
 * @route GET /api/v1/tournaments/:id
 * @description Get a specific tournament
 * @access Public
 * @param {string} req.params.id - Tournament ID
 * @param {boolean} [req.query.getStandings] - Whether to include standings
 * @param {number} [req.query.limitStandings] - Limit number of standings (default: 30)
 * @param {number} [req.query.skipStandings] - Number of standings to skip (default: 0)
 * @param {string} [req.query.userIdStanding] - Get specific user standing
 * @param {string} [req.query.sortFieldStandings] - Field to sort standings by (default: 'score')
 * @param {SortOrder} [req.query.sortDirectionStandings] - Sort direction (default: -1)
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   _id: string,
 *   disqualified: Array<{submission: string, reason: string}>,
 *   submissionCount: number,
 *   tournamentExecutionTime: number,
 *   game: string,
 *   standings?: Array<TournamentStanding>,
 *   userStanding?: TournamentStanding|null,
 *   createdAt: Date,
 *   updatedAt: Date
 * }|{error: string}} res.body - Tournament data or error message
 */
router.get('/:id',
	asyncErrorHandler(getTournament)
)

/**
 * @route GET /api/v1/tournaments/:id/statistics
 * @description Get statistics for a tournament
 * @access Public
 * @param {string} req.params.id - Tournament ID
 * @returns {number} res.status - HTTP status code
 * @returns {{
 *   scoreDistribution: {[score: number]: number},
 *   executionTimeStats: {min: number, max: number, avg: number},
 *   tokenCountStats: {min: number, max: number, avg: number},
 *   totalParticipants: number,
 *   disqualifiedCount: number
 * }|{error: string}} res.body - Tournament statistics or error message
 */
router.get('/:id/statistics',
	asyncErrorHandler(getTournamentStatistics)
)

/**
 * @route GET /api/v1/tournaments/:id/standings
 * @description Get standings for a tournament
 * @access Public
 * @param {string} req.params.id - Tournament ID
 * @param {number} [req.query.limitStandings] - Limit number of standings (default: 30)
 * @param {number} [req.query.skipStandings] - Number of standings to skip (default: 0)
 * @param {string} [req.query.sortFieldStandings] - Field to sort standings by (default: 'score')
 * @param {SortOrder} [req.query.sortDirectionStandings] - Sort direction (default: -1)
 * @returns {number} res.status - HTTP status code
 * @returns {Array<TournamentStanding>|{error: string}} res.body - Tournament standings or error message
 */
router.get('/:id/standings',
	asyncErrorHandler(getTournamentStandings)
)

export default router
