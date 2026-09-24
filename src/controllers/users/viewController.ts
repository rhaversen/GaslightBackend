import { type Request, type Response } from 'express'
import { z } from 'zod'

import { collectionExists, getLens, lensIdsFor, lensMetaFor } from '../../lenses/registry.js'
import { type LensDefinition, type LensParams } from '../../lenses/types.js'
import { ValidationError } from '../../utils/errors.js'
import logger from '../../utils/logger.js'

const viewQuerySchema = z.object({
	lens: z.string().min(1).default('browse'),
	q: z.string().max(100).optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
	me: z.string().optional(),
	sort: z.string().optional(),
	dir: z.enum(['asc', 'desc']).default('desc'),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	skip: z.coerce.number().int().min(0).default(0)
})

export async function viewCollection (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('View collection')

	const collection = String(req.params.collection)
	assertCollection(collection)

	const parsed = viewQuerySchema.safeParse(req.query)
	if (!parsed.success) {
		throw new ValidationError(`Invalid view query: ${parsed.error.issues.map(i => i.message).join(', ')}`)
	}

	const lens = assertLens(collection, parsed.data.lens)
	assertScope(lens.scopes, false)

	const params = toLensParams(parsed.data)
	const result = await lens.pipeline({ params })
	assertRowCap(lens.maxRows, result.rows.length)

	res.status(200).json({
		rows: result.rows,
		total: result.total,
		lens: {
			id: lens.id,
			from: lens.from,
			onto: lens.onto,
			cardinality: lens.cardinality,
			dateField: lens.dateField,
			renderer: lens.renderer,
			description: lens.description,
			display: lens.display,
			pivots: lens.pivots
		},
		window: { from: params.from, to: params.to },
		availableLenses: lensIdsFor(collection)
	})
}

export async function viewDocument (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('View document')

	const collection = String(req.params.collection)
	assertCollection(collection)

	const parsed = viewQuerySchema.safeParse(req.query)
	if (!parsed.success) {
		throw new ValidationError(`Invalid view query: ${parsed.error.issues.map(i => i.message).join(', ')}`)
	}

	const lens = assertLens(collection, parsed.data.lens)
	assertScope(lens.scopes, true)

	const params = toLensParams(parsed.data)
	const result = await lens.pipeline({ id: String(req.params.id), params })
	assertRowCap(lens.maxRows, result.rows.length)

	res.status(200).json({
		rows: result.rows,
		total: result.total,
		focus: result.focus,
		lens: {
			id: lens.id,
			from: lens.from,
			onto: lens.onto,
			cardinality: lens.cardinality,
			dateField: lens.dateField,
			renderer: lens.renderer,
			description: lens.description,
			display: lens.display,
			pivots: lens.pivots
		},
		window: { from: params.from, to: params.to },
		availableLenses: lensIdsFor(collection)
	})
}

function assertCollection (collection: string): void {
	if (!collectionExists(collection)) {
		throw new ValidationError(`Unknown collection: ${collection}`)
	}
}

/** Lightweight lens metadata for a collection — no pipeline runs. */
export async function viewMeta (
	req: Request,
	res: Response
): Promise<void> {
	const collection = String(req.params.collection)
	assertCollection(collection)
	res.status(200).json({ lenses: lensMetaFor(collection) })
}

function assertLens (collection: string, lensId: string): LensDefinition {
	const lens = getLens(collection, lensId)
	if (lens === undefined) {
		throw new ValidationError(`Unknown lens ${lensId} for collection ${collection}`)
	}
	return lens
}

function assertScope (scopes: 'document' | 'collection' | 'both', isDocument: boolean): void {
	if (scopes === 'document' && !isDocument) {
		throw new ValidationError('This lens requires an anchor document id')
	}
	if (scopes === 'collection' && isDocument) {
		throw new ValidationError('This lens does not take an anchor document id')
	}
}

function assertRowCap (maxRows: number, rowCount: number): void {
	if (rowCount > maxRows) {
		// Defensive: a lens pipeline ignoring its params is a bug, not a 200
		logger.error(`Lens exceeded maxRows: ${rowCount} > ${maxRows}`)
		throw new ValidationError('Lens output exceeded its declared capacity')
	}
}

function toLensParams (data: z.infer<typeof viewQuerySchema>): LensParams {
	// fanout lenses must be windowed; the route enforces a bound here so an
	// unbounded request cannot scan the whole event stream
	const params: LensParams = {
		q: data.q,
		from: data.from,
		to: data.to,
		me: data.me,
		sort: data.sort,
		dir: data.dir,
		limit: data.limit,
		skip: data.skip
	}
	if (params.from === undefined && params.to !== undefined) {
		params.from = new Date(0)
	}
	return params
}
