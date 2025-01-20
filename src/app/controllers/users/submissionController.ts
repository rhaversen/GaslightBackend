// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import GradingModel from '../../models/Grading.js'
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

	const maxAmount = Number(req.query.maxAmount) || 0
	const startIndex = Number(req.query.startIndex) || 0

	const query: any = {}

	const { fromDate, toDate } = req.query
	if ((typeof fromDate === 'string') && (typeof toDate === 'string')) {
		query.createdAt = {}
		if (typeof fromDate === 'string') query.createdAt.$gte = new Date(fromDate)
		if (typeof toDate === 'string') query.createdAt.$lte = new Date(toDate)
	}

	// Non-active submissions are considered private
	// Only show submissions that are active
	query.active = true

	try {
		const submissionsWithGrading = await SubmissionModel.aggregate([
			{ $match: query },
			{ $skip: startIndex },
			{ $limit: maxAmount },
			{
				$lookup: {
					from: 'gradings',
					localField: '_id',
					foreignField: 'submission',
					as: 'grading'
				}
			},
			{
				$addFields: {
					grading: { $arrayElemAt: ['$grading', 0] }
				}
			},
			{
				$project: {
					_id: 1,
					title: 1,
					user: 1,
					LOC: {
						$function: {
							body: 'function(submission) { return submission.getLoc(); }',
							args: ['$$ROOT'],
							lang: 'js'
						}
					},
					createdAt: 1,
					updatedAt: 1,
					grading: 1
				}
			}
		])

		res.status(200).json(submissionsWithGrading)
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

		// Manually set each field from allowed fields if it's present in the request body
		if (req.body.title !== undefined) { submission.title = req.body.title }
		if (req.body.code !== undefined) { submission.code = req.body.code }
		if (req.body.active !== undefined) { submission.active = req.body.active }

		await submission.validate()
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

export async function evaluateSubmission(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Requesting test grading')
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

		const response = await submitCodeForEvaluation(submission)

		if (response === false) {
			res.status(500).json({ error: 'Server Error' })
			return
		}

		let submissionPass = false
		let executionTimeExceeded = false
		let loadingTimeExceeded = false

		// Check if strategy loading time exceeded
		if (response.strategyLoadingTimings > strategyLoadingTimeout) {
			submissionPass = false
			loadingTimeExceeded = true
		}

		// Check if strategy execution time 99th percentile exceeded
		if (response.strategyExecutionTimings.sort()[Math.floor(response.strategyExecutionTimings.length * 0.99)] > strategyExecutionTimeout) {
			submissionPass = false
			executionTimeExceeded = true
		}

		// Check if disqualified
		if (response.disqualified !== null) {
			submissionPass = false
		}

		// Check if results are valid
		if (response.results === undefined) {
			submissionPass = false
		}

		// Update submission
		submission.passedEvaluation = submissionPass
		await submission.save()

		res.status(200).json({
			passed: submissionPass,
			results: response.results,
			disqualified: response.disqualified,
			executionTimeExceeded,
			loadingTimeExceeded,
			strategyLoadingTimings: response.strategyLoadingTimings,
			strategyExecutionTimings: response.strategyExecutionTimings
		})
	} catch (error) {
		next(error)
	}
}
