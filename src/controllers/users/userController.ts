import { type NextFunction, type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'

import SubmissionModel from '../../models/Submission.js'
import UserModel from '../../models/User.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js'
import { validate } from '../../utils/validate.js'

import { loginUserLocal } from './authController.js'

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	confirmPassword: z.string().min(1)
})

export const registerValidation = validate(registerSchema)

export async function register (req: Request, res: Response, next: NextFunction): Promise<void> {
	const { email, password, confirmPassword } = req.body

	if (password !== confirmPassword) {
		throw new ValidationError('Passwords do not match')
	}

	const existingUser = await UserModel.findOne({ email }).exec()

	if (existingUser === null) {
		const newUser = await UserModel.create({ email, password })
		newUser.confirmUser() // TODO: Implement confirmation logic later
		await newUser.save()
	}

	loginUserLocal(req, res, next)
}

export async function getAllUsers (req: Request, res: Response): Promise<void> {
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

export async function getUser (req: Request, res: Response): Promise<void> {
	const user = req.user
	const paramUser = await UserModel.findById(req.params.id).exec()

	if (paramUser === null) {
		throw new NotFoundError('User not found')
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

const updateUserSchema = z.object({
	username: z.string().min(1).optional(),
	email: z.string().email().optional(),
	password: z.string().min(1).optional(),
	confirmPassword: z.string().min(1).optional()
})

export const updateUserValidation = validate(updateUserSchema)

export async function updateUser (req: Request, res: Response): Promise<void> {
	const user = req.user

	if (user === undefined) {
		throw new ForbiddenError('Unauthorized')
	}

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		const paramUser = await UserModel.findById(req.params.id, null, { session })

		if (paramUser === null) {
			throw new NotFoundError('User not found')
		}

		if (user.id !== paramUser.id) {
			throw new ForbiddenError('Forbidden')
		}

		if (req.body.password !== undefined && req.body.password !== req.body.confirmPassword) {
			throw new ValidationError('Passwords do not match')
		}

		if (req.body.username !== undefined) { paramUser.username = req.body.username }
		if (req.body.email !== undefined) { paramUser.email = req.body.email }
		if (req.body.password !== undefined) { paramUser.password = req.body.password }

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
		throw error
	} finally {
		session.endSession()
	}
}