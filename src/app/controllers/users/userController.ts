// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Request, type Response } from 'express'

// Own modules
import { loginUserLocal } from './authController.js'
import UserModel from '../../models/User.js'

// Environment variables

// Config variables

// Destructuring and global variables

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
	const body: Record<string, unknown> = {
		email: req.body.email,
		password: req.body.password,
		confirmPassword: req.body.confirmPassword
	}

	const existingUser = await UserModel.findOne({ email: body.email }).exec()

	if (existingUser === null) {
		// User doesn't exist, create a new user
		const newUser = await UserModel.create({
			email: body.email,
			password: body.password,
		})
		newUser.confirmUser() // TODO: Implement confirmation logic later
		await newUser.save()
	}

	loginUserLocal(req, res, next)
}
