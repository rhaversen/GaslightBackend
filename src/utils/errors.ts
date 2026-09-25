// Service-level errors that the error handler maps to HTTP status codes.
// Controllers throw these instead of hand-rolling status code responses, so
// the errorHandler stays the only place that decides status codes.
export class NotFoundError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'NotFoundError'
	}
}

export class ForbiddenError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'ForbiddenError'
	}
}

export class ValidationError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'ValidationError'
	}
}
