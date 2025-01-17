// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import GradingModel from '../../models/Grading.js'
import SubmissionModel from '../../models/Submission.js'
import { submitCodeForTest } from '../../services/CodeRunner.js'
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

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		const newSubmission = await SubmissionModel.create([req.body], { session })

		await session.commitTransaction()
		res.status(201).json(newSubmission[0])
	} catch (error) {
		await session.abortTransaction()
		if (error instanceof mongoose.Error.ValidationError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	} finally {
		session.endSession()
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

	const session = await mongoose.startSession()
	session.startTransaction()

	try {
		// Retrieve the existing product document
		const submission = await SubmissionModel.findById(req.params.id, null, { session })

		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
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
		const submission = await SubmissionModel.findById(req.params.id)
		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
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
		const submission = await SubmissionModel.findById(req.params.id)
		if (submission === null) {
			res.status(404).json({ error: 'Submission not found' })
			return
		}
		const success = await submitCodeForTest(submission)
		if (!success) {
			res.status(500).json({ error: 'Failed to submit code for test' })
			return
		}
	} catch (error) {
		next(error)
	}
}

export async function getSubmissionGradings(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting submission gradings')
	try {
		const submissionId = req.params.id
		const submission = await SubmissionModel.findById(submissionId)

		if (!submission) {
			res.status(404).json({
				status: 'error',
				message: 'Submission not found'
			})
			return
		}

		const gradings = await GradingModel.find({ submission: submissionId })
		res.status(200).json({
			status: 'success',
			data: gradings
		})
	} catch (error) {
		if (error instanceof mongoose.Error.CastError) {
			res.status(400).json({
				status: 'error',
				message: 'Invalid submission ID'
			})
			return
		}
		next(error)
	}
}
