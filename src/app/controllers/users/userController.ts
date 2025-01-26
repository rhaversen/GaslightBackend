// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Request, type Response } from 'express'
import mongoose from 'mongoose'

// Own modules
import { loginUserLocal } from './authController.js'
import UserModel from '../../models/User.js'
import SubmissionModel from '../../models/Submission.js'

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

	// Use aggregation instead of multiple queries
	const counts = await SubmissionModel.aggregate([
		{ $group: { _id: '$user', count: { $sum: 1 } } }
	])
	const submissionCountMap = Object.fromEntries(
		counts.map(item => [item._id.toString(), item.count])
	)

	// Find each users active submission name
	const activeSubmissions = await SubmissionModel.find({ active: true }).exec()
	const activeSubmissionMap = Object.fromEntries(
		activeSubmissions.map(submission => [submission.user.toString(), submission.title])
	)

	const mappedUsers = users.map(user => {
		return {
			_id: user.id,
			username: user.username,
			email: user.id === reqUser?.id ? user.email : null,
			expirationDate: user.id === reqUser?.id ? user.expirationDate : null,
			confirmed: user.id === reqUser?.id ? user.confirmed : null,
			submissionCount: submissionCountMap[user.id] || 0,
			activeSubmission: activeSubmissionMap[user.id] || null,
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
		_id: paramUser.id,
		username: paramUser.username,
		email: paramUser.id === user?.id ? paramUser.email : null,
		expirationDate: paramUser.id === user?.id ? paramUser.expirationDate : null,
		confirmed: paramUser.id === user?.id ? paramUser.confirmed : null,
		submissionCount: await SubmissionModel.countDocuments({ user: paramUser.id }),
		activeSubmission: (await SubmissionModel.findOne({ user: paramUser.id, active: true }).exec())?.title || null,
		createdAt: paramUser.createdAt,
		updatedAt: paramUser.updatedAt
	}

	res.status(200).json(mappedUser)
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
	const user = req.user

	if (user === undefined) {
		res.status(401).json({ error: 'Unauthorized' })
		return
	}

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		const paramUser = await UserModel.findById(req.params.id, null, { session })

		if (paramUser === null) {
			res.status(404).json({ error: 'User not found' })
			return
		}

		if (user.id !== paramUser.id) {
			res.status(403).json({ error: 'Forbidden' })
			return
		}

		if (req.body.password !== undefined && req.body.password !== req.body.confirmPassword) {
			res.status(400).json({ error: 'Passwords do not match' })
			return
		}

		if (req.body.username !== undefined) paramUser.username = req.body.username
		if (req.body.email !== undefined) paramUser.email = req.body.email
		if (req.body.password !== undefined) paramUser.password = req.body.password

		await paramUser.validate()
		await paramUser.save({ session })
		await session.commitTransaction()

		const mappedUser = {
			_id: paramUser.id,
			username: paramUser.username,
			email: paramUser.email,
			expirationDate: paramUser.expirationDate,
			confirmed: paramUser.confirmed,
			submissionCount: await SubmissionModel.countDocuments({ user: paramUser.id }),
			activeSubmission: (await SubmissionModel.findOne({ user: paramUser.id, active: true }).exec())?.title || null,
			createdAt: paramUser.createdAt,
			updatedAt: paramUser.updatedAt
		}

		res.status(200).json(mappedUser)
	} catch (error) {
		await session.abortTransaction()
		if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	} finally {
		session.endSession()
	}
}