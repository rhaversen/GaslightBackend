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
	const authHeader = req.headers.authorization

	if (!authHeader) {
		logger.error('Authorization header not found')
		return res.status(401).send({ message: 'Authorization header not found' })
	}

	const [scheme, token] = authHeader.split(' ')

	if (scheme !== 'Bearer' || !token) {
		logger.error('Invalid authorization format')
		return res.status(401).send({ message: 'Invalid authorization format' })
	}

	if (token !== MICROSERVICE_AUTHORIZATION) {
		logger.error('Invalid authorization token')
		return res.status(401).send({ message: 'Invalid authorization token' })
	}

	next()
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
	if (!req.user) {
		logger.error('Unauthorized access')
		return res.status(401).send({ message: 'Unauthorized access' })
	}

	next()
}
