import { type Document } from 'mongoose'

// Lens system types. A lens is a named, server-side projection from a source
// collection onto a renderable dataset. Pipelines are computed on read —
// nothing is materialized, no stat lives on a document.

export type CollectionName = 'user' | 'game' | 'tournament' | 'strategy'

/** How a lens may be addressed. Document scope needs an anchor id. */
export type LensScope = 'document' | 'collection' | 'both'

/**
 * Cost class drives request-time guards:
 * - edge: anchored traversal along indexed edges. Paginatable without limits.
 * - fanout: aggregates over a whole window of the event stream. Requires a
 *   time window (bounded), caps output rows, uses allowDiskUse.
 */
export type CostClass = 'edge' | 'fanout'

export type Renderer = 'list' | 'table' | 'timeline' | 'timeline-multi' | 'compare'

/** A row field that links into another collection's view. */
export interface LensPivot {
	/** Row field carrying the target document id */
	field: string
	/** Row field carrying the resolved display label of the target */
	labelField: string
	collection: CollectionName
	/** Chip text, e.g. 'Author' */
	text: string
}

export interface ViewRow {
	/** Event date of the row (lens dateField), rendered by every UI */
	date?: Date
	/** Anchor document id the row belongs to or came from */
	id?: string
	/** Display label of the anchor/row document */
	label?: string
	[key: string]: unknown
}

/** Resolved title for a document-scope view (drives the focus header). */
export interface ViewFocus {
	label: string
	subtitle?: string
}

export interface LensParams {
	/** Free-text search over the lens's label field */
	q?: string
	/** ISO date — start of the time window */
	from?: Date
	/** ISO date — end of the time window */
	to?: Date
	/** Highlight parameter: the logged-in user (or an explicit target) */
	me?: string
	sort?: string
	dir?: 'asc' | 'desc'
	limit: number
	skip: number
}

export interface ViewResult {
	rows: ViewRow[]
	total: number
	/** Document-scope views describe the anchor for the focus header */
	focus?: ViewFocus
}

export interface LensDefinition {
	id: string
	from: CollectionName
	/** What the lens outputs — drives which pivots are offered on rows */
	onto: CollectionName | 'row'
	scopes: LensScope
	cardinality: 'one' | 'many'
	dateField: string
	costClass: CostClass
	/** Worst-case rows per request — a lens that cannot state one does not ship */
	maxRows: number
	renderer: Renderer
	/** User-facing description, also drives the lens tab tooltip */
	description: string
	/** Ordered scalar row fields rendered as stat chips */
	display: string[]
	/** Row fields that are exits into other collections */
	pivots: LensPivot[]
	pipeline: (scope: { id?: string, params: LensParams }) => ViewResult | Promise<ViewResult>
}

export type WithId<T extends Document> = T & { id: string }
