import { type NextFunction, type Request, type Response } from 'express'
import { type ZodType } from 'zod'

import logger from './logger.js'

// Validate req.body against a zod schema. On failure: 400 with the flattened
// error. On success: replace req.body with the parsed value and call next.
// Keeps routes thin and removes untyped req.body access from controllers.
export function validate (schema: ZodType): (req: Request, res: Response, next: NextFunction) => void {
	return (req, res, next) => {
		const parsed = schema.safeParse(req.body)
		if (!parsed.success) {
			logger.warn('Validation failed (zod)', {
				method: req.method,
				path: req.originalUrl,
				issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
			})
			res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
			return
		}
		req.body = parsed.data
		next()
	}
}
