import { type NextFunction, type Request, type RequestHandler, type Response } from 'express'

// Wrap async route handlers so rejected promises forward to the error
// handler via `next`. Lets routes/controllers throw; the errorHandler maps.
export function asyncHandler (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
	return (req, res, next) => {
		void fn(req, res, next).then(undefined, next)
	}
}
