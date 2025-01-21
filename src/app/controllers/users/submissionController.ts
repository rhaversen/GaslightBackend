// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import SubmissionModel from '../../models/Submission.js'
import { submitCodeForEvaluation } from '../../services/CodeRunner.js'
import logger from '../../utils/logger.js'
import { IUser } from '../../models/User.js'
import configs from '../../utils/setupConfig.js'

// Environment variables

// Config variables
const {
	strategyExecutionTimeout,
	strategyLoadingTimeout
} = configs

// Destructuring and global variables

export async function createSubmission(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Creating submission')

	const user = req.user as IUser

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

	const maxAmount = Number(req.query.maxAmount) || 100
	const startIndex = Number(req.query.startIndex) || 0
	const user = req.user as IUser | undefined

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

		const submissionsWithLOC = submissions.map(submission => ({
			_id: submission.id,
			title: submission.title,
			code: submission.user === user?.id ? submission.code : null,
			user: submission.user,
			active: submission.active,
			passedEvaluation: submission.passedEvaluation,
			tokenCount: submission.getTokenCount(),
			evaluation: submission.evaluation,
			createdAt: submission.createdAt,
			updatedAt: submission.updatedAt
		}))

		res.status(200).json(submissionsWithLOC)
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
	const user = req.user as IUser

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

			let submissionPass = true
			let executionTimeExceeded = false
			let loadingTimeExceeded = false

			// Check if strategy loading time exceeded
			if (evaluationResult.strategyLoadingTimings !== null && evaluationResult.strategyLoadingTimings > strategyLoadingTimeout) {
				submissionPass = false
				loadingTimeExceeded = true
			}

			// Check if average strategy execution time exceeded
			const executionTimings = evaluationResult.strategyExecutionTimings
			const averageExecutionTime = executionTimings ? executionTimings.reduce((a, b) => a + b, 0) / executionTimings.length : null
			if (executionTimings && averageExecutionTime !== null && averageExecutionTime > strategyExecutionTimeout) {
				submissionPass = false
				executionTimeExceeded = true
			}

			// Check if disqualified
			if (evaluationResult.disqualified !== null) {
				submissionPass = false
			}

			// Check if results are valid
			if (evaluationResult.results === undefined) {
				submissionPass = false
			}

			// Update submission with evaluation results
			submission.passedEvaluation = submissionPass
			submission.evaluation = {
				results: evaluationResult.results ? {
					candidate: evaluationResult.results.candidate,
					average: evaluationResult.results.average
				} : undefined,
				disqualified: evaluationResult.disqualified,
				executionTimeExceeded: executionTimeExceeded,
				loadingTimeExceeded: loadingTimeExceeded,
				strategyLoadingTimings: evaluationResult.strategyLoadingTimings ?? undefined,
				strategyExecutionTimings: evaluationResult.strategyExecutionTimings ?? undefined,
				averageExecutionTime: averageExecutionTime ?? undefined
			}

			// If the didnt pass evaluation, set it as inactive
			if (!submission.passedEvaluation) {
				submission.active = false
			}
		}

		await submission.save({ session })

		await session.commitTransaction()

		res.status(200).json(submission)
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
		const user = req.user as IUser
		const submission = await SubmissionModel.findById(req.params.id)
		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
			return
		}
		if (submission.user.toString() !== user.id) {
			res.status(403).json({ error: 'Forbidden' })
			return
		}
		res.status(200).json(submission)
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
	const user = req.user as IUser
	try {
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
