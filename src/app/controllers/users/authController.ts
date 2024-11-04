// Node.js built-in modules

// Third-party libraries
import passport from 'passport'
import { type NextFunction, type Request, type Response } from 'express'

// Own modules
import config from '../../utils/setupConfig.js'
import logger from '../../utils/logger.js'
import { type IUser } from '../../models/User.js'

// Environment variables

// Config variables
const {
	sessionExpiry
} = config

// Destructuring and global variables

export async function loginUserLocal (req: Request, res: Response, next: NextFunction): Promise<void> {
	// Check if name and password are provided
	if (req.body.name === undefined || req.body.password === undefined) {
		res.status(400).json({
			auth: false,
			error: 'Name and password must be provided'
		})
		return
	}

	passport.authenticate('user-local', (err: Error, user: Express.User, info: { message: string }) => {
		if (err !== null && err !== undefined) {
			return res.status(500).json({
				auth: false,
				error: err.message
			})
		}

		if (user === null || user === undefined || user === false) {
			return res.status(401).json({
				auth: false,
				error: info.message
			})
		}

		req.logIn(user, loginErr => {
			if (loginErr !== null && loginErr !== undefined) {
				return res.status(500).json({
					auth: false,
					error: loginErr.message
				})
			}

			// Set maxAge for persistent sessions if requested
			if (req.body.stayLoggedIn === true || req.body.stayLoggedIn === 'true') {
				req.session.cookie.maxAge = sessionExpiry
			}

			const loggedInUser = user as IUser

			const userWithoutPassword = {
				_id: loggedInUser._id,
				username: loggedInUser.username,
				email: loggedInUser.email,
				confirmed: loggedInUser.confirmed,
				expirationDate: loggedInUser.expirationDate,
				createdAt: loggedInUser.createdAt,
				updatedAt: loggedInUser.updatedAt,
			}

			res.status(200).json({
				auth: true,
				user: userWithoutPassword
			})
		})
	})(req, res, next)
}

export async function logoutLocal (req: Request, res: Response, next: NextFunction): Promise<void> {
	req.logout(function (err) {
		if (err !== null && err !== undefined) {
			next(err)
			return
		}

		req.session.destroy(function (sessionErr) {
			if (sessionErr !== null && sessionErr !== undefined) {
				next(sessionErr)
				return
			}
			res.clearCookie('connect.sid')
			res.status(200).json({ message: 'Logged out' })
		})
	})
}

export function ensureAuthenticated (req: Request, res: Response, next: NextFunction): void {
	logger.silly('Ensuring authentication')

	if (!req.isAuthenticated()) {
		res.status(401).json({ message: 'Unauthorized' })
		return
	}
	next()
}
