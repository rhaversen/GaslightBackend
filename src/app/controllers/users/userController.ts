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

	if (body.password !== body.confirmPassword) {
		res.status(400).json({
			auth: false,
			error: 'Passwords do not match'
		})
		return
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

export async function getAllUsers(req: Request, res: Response): Promise<void> {
	const reqUser = req.user
	const users = await UserModel.find().exec()

	const mappedUsers = users.map(user => {
		return {
			username: user.username,
			email: user.id === reqUser?.id ? user.email : null,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		}
	})

	res.status(200).json(mappedUsers)
}

export async function getUser(req: Request, res: Response): Promise<void> {
	const user = req.user
	const paramUser = await UserModel.findById(req.params.id).exec()

	if (paramUser === null) {
		res.status(404).json({
			error: 'User not found'
		})
		return
	}

	const mappedUser = {
		username: paramUser.username,
		email: paramUser.id === user?.id ? paramUser.email : null,
		createdAt: paramUser.createdAt,
		updatedAt: paramUser.updatedAt
	}

	res.status(200).json(mappedUser)
}
