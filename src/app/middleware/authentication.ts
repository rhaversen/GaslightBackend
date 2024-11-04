// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Request, type Response } from 'express'

// Own modules
import logger from '../utils/logger.js'

// Environment variables
const { MICROSERVICE_AUTHORIZATION } = process.env

// Config variables

// Destructuring and global variables

export function authenticateMicroservice(req: Request, res: Response, next: NextFunction) {
	const { authorization } = req.headers

	if (!authorization) {
		logger.error('Authorization header not found')
		return res.status(401).send({ message: 'Authorization header not found' })
	}

	if (authorization !== MICROSERVICE_AUTHORIZATION) {
		logger.error('Invalid authorization header')
		return res.status(401).send({ message: 'Invalid authorization header' })
	}

	next()
}
