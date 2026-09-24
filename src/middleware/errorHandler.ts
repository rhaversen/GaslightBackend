import { type ErrorRequestHandler } from 'express'

import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js'
import logger from '../utils/logger.js'

// Mounted last in index.ts. Controllers throw; the handler maps. This is the
// only place that decides status codes, so controllers stop hand-rolling
// try/catch and status responses.

// Map a Mongoose ValidationError into the same { error, details } shape zod
// produces, so the frontend can surface field-by-field messages.
function mongooseToResponse (err: Error): { error: string, details: { fieldErrors: Record<string, string[]> } } {
	const e = err as unknown as { errors?: Record<string, { message: string }> }
	const fieldErrors: Record<string, string[]> = {}
	if (e.errors !== undefined) {
		for (const [path, info] of Object.entries(e.errors)) {
			const leaf = path.split('.').pop() ?? path
			fieldErrors[leaf] = fieldErrors[leaf] === undefined ? [info.message] : [...fieldErrors[leaf], info.message]
		}
	}
	return { error: 'Invalid input', details: { fieldErrors } }
}

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
	const reqMeta = { method: req.method, path: req.originalUrl }
	if (err instanceof NotFoundError) {
		logger.warn('NotFound', { ...reqMeta, error: err.message })
		res.status(404).json({ error: err.message })
		return
	}
	if (err instanceof ForbiddenError) {
		logger.warn('Forbidden', { ...reqMeta, error: err.message })
		res.status(403).json({ error: err.message })
		return
	}
	if (err instanceof ValidationError) {
		logger.warn('Validation failed (service)', { ...reqMeta, error: err.message })
		res.status(400).json({ error: err.message })
		return
	}

	// Mongoose schema validation failures should be 400s with field details,
	// not opaque 500s.
	if (err.name === 'ValidationError' && !(err instanceof ValidationError)) {
		const body = mongooseToResponse(err)
		logger.warn('Validation failed (mongoose)', { ...reqMeta, name: err.name, message: err.message, details: body.details })
		res.status(400).json(body)
		return
	}

	logger.error('Unhandled error', {
		...reqMeta,
		name: err.name,
		message: err.message,
		stack: err.stack,
		error: err
	})
	res.status(500).json({ error: 'Internal server error' })
}

export default errorHandler
