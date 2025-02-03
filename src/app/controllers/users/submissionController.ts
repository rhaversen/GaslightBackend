// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import SubmissionModel from '../../models/Submission.js'
import { submitCodeForEvaluation } from '../../services/CodeRunner.js'
import logger from '../../utils/logger.js'

// Environment variables

// Config variables

// Destructuring and global variables

export async function createSubmission(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Creating submission')

	const user = req.user

	if (user === undefined) {
		res.status(401).json({ error: 'Unauthorized' })
		return
	}

	const allowedFields = {
		title: req.body.title,
		code: req.body.code,
	}

	try {
		const newSubmission = await SubmissionModel.create({
			...allowedFields,
			user: user.id
		})
		res.status(201).json(newSubmission)
	} catch (error) {
		if (error instanceof mongoose.Error.ValidationError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	}
}

export async function getSubmissions(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting submissions')

	const maxAmount = Number(req.query.maxAmount) || 0
	const startIndex = Number(req.query.startIndex) || 0
	const user = req.user

	const query: any = {}

	const { fromDate, toDate } = req.query
	if ((typeof fromDate === 'string') && (typeof toDate === 'string')) {
		query.createdAt = {}
		if (typeof fromDate === 'string') query.createdAt.$gte = new Date(fromDate)
		if (typeof toDate === 'string') query.createdAt.$lte = new Date(toDate)
	}

	if (req.query.active !== undefined) query.active = req.query.adjective
	if (req.query.passedEvaluation !== undefined) query.passedEvaluation = req.query.passedEvaluation
	if (req.query.user !== undefined) query.user = req.query.user

	try {
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
			tokenCount: submission.getTokenCount(),
			evaluation: submission.evaluation,
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt
		}))

		res.status(200).json(formattedSubmission)
	} catch (error) {
		if (error instanceof mongoose.Error.ValidationError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	}
}

export async function updateSubmission(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Updating submission')
	const user = req.user

	if (user === undefined) {
		res.status(401).json({ error: 'Unauthorized' })
		return
	}

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		// Retrieve the existing product document
		const submission = await SubmissionModel.findById(req.params.id, null, { session })

		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
			return
		}

		if (submission.user.toString() !== user.id) {
			res.status(403).json({ error: 'Forbidden' })
			return
		}

		const codeUpdated = req.body.code !== undefined && req.body.code !== submission.code

		// Manually set each field from allowed fields if it's present in the request body
		if (req.body.title !== undefined) { submission.title = req.body.title }
		if (req.body.code !== undefined) { submission.code = req.body.code }
		if (req.body.active !== undefined) { submission.active = req.body.active }

		await submission.validate()
		
		// If the code was updated or the submission was not evaluated yet, re-evaluate it
		if (codeUpdated || submission.passedEvaluation === null) {
			const evaluationResult = await submitCodeForEvaluation(submission)

			if (evaluationResult === false) {
				res.status(500).json({ error: 'Server Error' })
				return
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
			tokenCount: submission.getTokenCount(),
			evaluation: submission.evaluation,
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt
		}

		res.status(200).json(formattedSubmission)
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

export async function getSubmission(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting submission')
	try {
		const user = req.user
		const submission = await SubmissionModel.findById(req.params.id)
		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
			return
		}

		const formattedSubmission = {
			_id: submission.id,
			title: submission.title,
			code: submission.user.toString() === user?.id ? submission.code : null,
			user: submission.user,
			active: submission.active,
			passedEvaluation: submission.passedEvaluation,
			tokenCount: submission.getTokenCount(),
			evaluation: submission.evaluation,
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt
		}

		res.status(200).json(formattedSubmission)
	} catch (error) {
		next(error)
	}
}

export async function deleteSubmission(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Deleting submission')
	const user = req.user
	try {
		if (user === undefined) {
			res.status(401).json({ error: 'Unauthorized' })
			return
		}
		const submission = await SubmissionModel.findById(req.params.id)
		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
			return
		}
		if (submission.user.toString() !== user.id) {
			res.status(403).json({ error: 'Forbidden' })
			return
		}
		await submission.deleteOne()
		res.status(204).end()
	}
	catch (error) {
		next(error)
	}
}

export async function reEvaluateSubmission(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Re-evaluating submission')
	const user = req.user

	if (user === undefined) {
		res.status(401).json({ error: 'Unauthorized' })
		return
	}

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		const submission = await SubmissionModel.findById(req.params.id, null, { session })

		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
			return
		}

		if (submission.user.toString() !== user.id) {
			res.status(403).json({ error: 'Forbidden' })
			return
		}

		const evaluationResult = await submitCodeForEvaluation(submission)

		if (evaluationResult === false) {
			res.status(500).json({ error: 'Server Error' })
			return
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
			tokenCount: submission.getTokenCount(),
			evaluation: submission.evaluation,
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt
		}

		res.status(200).json(formattedSubmission)
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
