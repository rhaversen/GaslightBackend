import { Router } from 'express'

import {
	viewCollection,
	viewDocument,
	viewMeta
} from '../../controllers/users/viewController.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

const router = Router()

/**
 * @route GET /api/v1/view/:collection
 * @description Project a collection through a lens (collection scope)
 * @access Public
 * @param {string} req.params.collection - Collection name (user|game|tournament|strategy)
 * @param {string} [req.query.lens] - Lens id (default: browse)
 * @param {string} [req.query.from] - Window start (ISO date)
 * @param {string} [req.query.to] - Window end (ISO date)
 * @param {string} [req.query.me] - Highlight target (usually the logged-in user)
 * @param {string} [req.query.sort] - Row field to sort by
 * @param {string} [req.query.dir] - Sort direction (asc|desc)
 * @param {number} [req.query.limit] - Max rows (1-200, default 50)
 * @param {number} [req.query.skip] - Rows to skip
 * @returns {number} res.status - HTTP status code
 * @returns {{rows: Array, total: number, lens: Object, window: Object, availableLenses: Array}} res.body
 */
router.get('/:collection',
	asyncHandler(viewCollection)
)

/**
 * @route GET /api/v1/view/:collection/meta
 * @description Lens metadata for a collection (no pipeline execution)
 * @access Public
 * @returns {number} res.status - HTTP status code
 * @returns {{lenses: Array<{id: string, description: string, renderer: string, scopes: string}>}} res.body
 */
router.get('/:collection/meta',
	asyncHandler(viewMeta)
)

/**
 * @route GET /api/v1/view/:collection/:id
 * @description Project an anchor document through a lens (document scope)
 * @access Public
 * @param {string} req.params.collection - Collection name
 * @param {string} req.params.id - Anchor document id
 * @param {string} [req.query.lens] - Lens id
 * @param {string} [req.query.from] - Window start (ISO date)
 * @param {string} [req.query.to] - Window end (ISO date)
 * @param {string} [req.query.me] - Highlight target
 * @param {number} [req.query.limit] - Max rows (1-200, default 50)
 * @param {number} [req.query.skip] - Rows to skip
 * @returns {number} res.status - HTTP status code
 * @returns {{rows: Array, total: number, lens: Object, window: Object, availableLenses: Array}} res.body
 */
router.get('/:collection/:id',
	asyncHandler(viewDocument)
)

export default router
