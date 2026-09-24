import { type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'

import GameModel from '../../models/Game.js'
import SubmissionModel from '../../models/Submission.js'
import { submitCodeForEvaluation } from '../../services/CodeRunner.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js'
import logger from '../../utils/logger.js'
import { validate } from '../../utils/validate.js'

const createSubmissionSchema = z.object({
	title: z.string().min(1),
	code: z.string().min(1),
	game: z.string().min(1)
})

export const createSubmissionValidation = validate(createSubmissionSchema)

export async function createSubmission (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Creating submission')

	const user = req.user
	if (user === undefined) {
		throw new ForbiddenError('Unauthorized')
	}

	const submission = await SubmissionModel.create({
		title: req.body.title,
		code: req.body.code,
		game: req.body.game,
		user: user.id
	})

	res.status(201).json(submission)
}

export async function getSubmissions (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting submissions')

	const maxAmount = Number(req.query.maxAmount) || 0
	const startIndex = Number(req.query.startIndex) || 0
	const user = req.user

	interface DateRangeQuery {
		active?: boolean
		passedEvaluation?: boolean | null
		user?: string
		game?: string
		createdAt?: { $gte?: Date, $lte?: Date }
	}

	const query: DateRangeQuery = {}

	const { fromDate, toDate } = req.query
	if ((typeof fromDate === 'string') && (typeof toDate === 'string')) {
		query.createdAt = {}
		if (typeof fromDate === 'string') { query.createdAt.$gte = new Date(fromDate) }
		if (typeof toDate === 'string') { query.createdAt.$lte = new Date(toDate) }
	}

	if (req.query.active !== undefined) { query.active = req.query.active === 'true' }
	if (req.query.passedEvaluation !== undefined) { query.passedEvaluation = req.query.passedEvaluation === 'true' }
	if (typeof req.query.user === 'string') { query.user = req.query.user }
	if (typeof req.query.game === 'string') { query.game = req.query.game }

	const submissions = await SubmissionModel
		.find(query)
		.skip(startIndex)
		.limit(maxAmount)
		.exec()

	const formattedSubmission = submissions.map(submission => ({
		_id: submission.id,
		title: submission.title,
		code: submission.user.toString() === user?.id ? submission.code : null,
		user: submission.user,
		active: submission.active,
		passedEvaluation: submission.passedEvaluation,
		tokenCount: submission.tokenCount,
		evaluation: submission.evaluation,
		game: submission.game,
		createdAt: submission.createdAt,
		updatedAt: submission.updatedAt
	}))

	res.status(200).json(formattedSubmission)
}

const updateSubmissionSchema = z.object({
	title: z.string().min(1).optional(),
	code: z.string().min(1).optional(),
	active: z.boolean().optional()
})

export const updateSubmissionValidation = validate(updateSubmissionSchema)

export async function updateSubmission (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Updating submission')
	const user = req.user
	if (user === undefined) {
		throw new ForbiddenError('Unauthorized')
	}

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		const submission = await SubmissionModel.findById(req.params.id, null, { session })

		if (submission === null) {
			throw new NotFoundError('Submission not found')
		}

		if (submission.user.toString() !== user.id) {
			throw new ForbiddenError('Forbidden')
		}

		const codeUpdated = req.body.code !== undefined && req.body.code !== submission.code

		if (req.body.title !== undefined) { submission.title = req.body.title }
		if (req.body.code !== undefined) { submission.code = req.body.code }
		if (req.body.active !== undefined) { submission.active = req.body.active }

		await submission.validate()

		// If the code was updated or the submission was not evaluated yet, re-evaluate it
		if (codeUpdated || submission.passedEvaluation === null) {
			const game = await GameModel.findById(submission.game)
			if (game === null) {
				throw new NotFoundError('Game not found')
			}
			const evaluationResult = await submitCodeForEvaluation(user.id, submission, game)

			if (evaluationResult === false) {
				throw new ValidationError('Evaluation failed')
			}

			submission.passedEvaluation = evaluationResult.passedEvaluation
			submission.evaluation = evaluationResult.evaluation

			if (!submission.passedEvaluation) {
				submission.active = false
			}
		}

		await submission.save({ session })
		await session.commitTransaction()

		const formattedSubmission = {
			_id: submission.id,
			title: submission.title,
			code: submission.user.toString() === user.id ? submission.code : null,
			user: submission.user,
			active: submission.active,
			passedEvaluation: submission.passedEvaluation,
			tokenCount: submission.tokenCount,
			evaluation: submission.evaluation,
			game: submission.game,
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt
		}

		res.status(200).json(formattedSubmission)
	} catch (error) {
		await session.abortTransaction()
		throw error
	} finally {
		session.endSession()
	}
}

export async function getSubmission (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting submission')
	const user = req.user
	const submission = await SubmissionModel.findById(req.params.id)
	if (submission === null) {
		throw new NotFoundError('Submission not found')
	}

	const formattedSubmission = {
		_id: submission.id,
		title: submission.title,
		code: submission.user.toString() === user?.id ? submission.code : null,
		user: submission.user,
		active: submission.active,
		passedEvaluation: submission.passedEvaluation,
		tokenCount: submission.tokenCount,
		evaluation: submission.evaluation,
		game: submission.game,
		createdAt: submission.createdAt,
		updatedAt: submission.updatedAt
	}

	res.status(200).json(formattedSubmission)
}

export async function deleteSubmission (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Deleting submission')
	const user = req.user
	if (user === undefined) {
		throw new ForbiddenError('Unauthorized')
	}
	const submission = await SubmissionModel.findById(req.params.id)
	if (submission === null) {
		throw new NotFoundError('Submission not found')
	}
	if (submission.user.toString() !== user.id) {
		throw new ForbiddenError('Forbidden')
	}
	await submission.deleteOne()
	res.status(204).end()
}

export async function reEvaluateSubmission (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Re-evaluating submission')
	const user = req.user

	if (user === undefined) {
		throw new ForbiddenError('Unauthorized')
	}

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		const submission = await SubmissionModel.findById(req.params.id, null, { session })

		if (submission === null) {
			throw new NotFoundError('Submission not found')
		}

		if (submission.user.toString() !== user.id) {
			throw new ForbiddenError('Forbidden')
		}

		const game = await GameModel.findById(submission.game)
		if (game === null) {
			throw new NotFoundError('Game not found')
		}

		const evaluationResult = await submitCodeForEvaluation(user.id, submission, game)
		if (evaluationResult === false) {
			throw new ValidationError('Evaluation failed')
		}

		submission.passedEvaluation = evaluationResult.passedEvaluation
		submission.evaluation = evaluationResult.evaluation

		if (!submission.passedEvaluation) {
			submission.active = false
		}

		await submission.save({ session })
		await session.commitTransaction()

		const formattedSubmission = {
			_id: submission.id,
			title: submission.title,
			code: submission.user.toString() === user.id ? submission.code : null,
			user: submission.user,
			active: submission.active,
			passedEvaluation: submission.passedEvaluation,
			tokenCount: submission.tokenCount,
			evaluation: submission.evaluation,
			game: submission.game,
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt
		}

		res.status(200).json(formattedSubmission)
	} catch (error) {
		await session.abortTransaction()
		throw error
	} finally {
		session.endSession()
	}
}
