import { type Request, type Response } from 'express'

// Minimal fake req/res for unit-testing express controllers without HTTP.
// The response records what the controller did; `done` resolves when the
// controller writes a response, so tests can simply await it.

export interface RecordedResponse extends Response {
	statusCode: number
	body: unknown
}

export function fakeReq (options: {
	params?: Record<string, string>
	query?: Record<string, string | undefined>
	body?: unknown
}): Request {
	return {
		params: options.params ?? {},
		query: options.query ?? {},
		body: options.body ?? {}
	} as unknown as Request
}

export function fakeRes (): { res: Response, done: Promise<RecordedResponse> } {
	let resolveDone: (r: RecordedResponse) => void = () => {}
	const done = new Promise<RecordedResponse>(resolve => { resolveDone = resolve })

	const res = {
		statusCode: 0,
		body: undefined as unknown,
		status (code: number) {
			this.statusCode = code
			return this
		},
		json (body: unknown) {
			this.body = body
			resolveDone(this as unknown as RecordedResponse)
			return this
		},
		end () {
			resolveDone(this as unknown as RecordedResponse)
			return this
		}
	}
	return { res: res as unknown as Response, done }
}
