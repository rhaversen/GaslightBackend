// Node.js built-in modules

// Third-party libraries
import { Request, Response } from 'express'

// Own modules
import GradingModel, { IGrading } from '../../models/Grading.js'
import SubmissionModel, { ISubmissionPopulated } from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import logger from '../../utils/logger.js'
import { submission } from '../../services/CodeRunner.js'

// Environment variables

// Config variables

// Destructuring and global variables

export async function getActiveSubmissions(req: Request, res: Response) {
	try {
		const submissions = await SubmissionModel.find({ active: true, passedEvaluation: true }).exec()
		const mappedSubmissions: submission[] = submissions.map(sub => ({
			submissionId: sub.id,
			files: { 'main.ts': sub.code }
		}))
		res.status(200).json(mappedSubmissions)
	} catch (error) {
		logger.error(error)
		res.status(500).json({ error: 'Server error' })
	}
}

export async function saveGradingsWithTournament(req: Request, res: Response) {
	const {
		gradings,
		disqualified,
	 } = req.body

	if (!Array.isArray(gradings)) {
		return res.status(400).json({ error: 'Gradings must be an array' })
	}

	try {
		// Calculate z-scores before insertion
		const scores = gradings.map(g => g.score)
		const mean = scores.reduce((a, b) => a + b, 0) / scores.length
		const standardDeviation = Math.sqrt(
			scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
		)

		// Add z-scores to gradings
		const gradingsWithZ = gradings.map(grading => ({
			...grading,
			zValue: standardDeviation === 0 ? 0 : (grading.score - mean) / standardDeviation
		}))

		const newGradings = await GradingModel.insertMany(gradingsWithZ) as IGrading[]
		const gradingIds = newGradings.map(grading => grading._id)

		// Get all submissions for the gradings
		const submissions = await SubmissionModel
			.find({ _id: { $in: newGradings.map(g => g.submission) } })
			.populate('user', 'username')
			.exec() as ISubmissionPopulated[]

		const submissionMap = new Map(
			submissions.map(sub => [sub.id, sub])
		)

		// Calculate percentiles from original scores array
		scores.sort((a, b) => a - b)
		const statistics = {
			percentiles: {
				p25: scores[Math.floor(scores.length * 0.25)],
				p50: scores[Math.floor(scores.length * 0.50)],
				p75: scores[Math.floor(scores.length * 0.75)],
				p90: scores[Math.floor(scores.length * 0.90)]
			},
			averageScore: mean,
			medianScore: scores[Math.floor(scores.length * 0.5)]
		}

		// Define winner type
		type Winner = {
			user: string;
			submission: string;
			grade: number;
			zValue: number;
		}

		type Winners = {
			first: Winner;
			second?: Winner;
			third?: Winner;
		}

		// Initialize winners object with type
		const firstSubmission = submissionMap.get(newGradings[0].submission.toString())
		if (!firstSubmission?.user) {
			throw new Error('First place submission user not found')
		}

		const winners: Winners = {
			first: {
				user: typeof firstSubmission.user === 'string' 
					? firstSubmission.user 
					: firstSubmission.user.id,
				submission: newGradings[0].submission.toString(),
				grade: newGradings[0].score,
				zValue: newGradings[0].zValue
			}
		}

		if (newGradings.length > 1) {
			const secondSubmission = submissionMap.get(newGradings[1].submission.toString())
			if (secondSubmission?.user) {
				winners.second = {
					user: typeof secondSubmission.user === 'string'
						? secondSubmission.user
						: secondSubmission.user.id,
					submission: newGradings[1].submission.toString(),
					grade: newGradings[1].score,
					zValue: newGradings[1].zValue
				}
			}
		}

		if (newGradings.length > 2) {
			const thirdSubmission = submissionMap.get(newGradings[2].submission.toString())
			if (thirdSubmission?.user) {
				winners.third = {
					user: typeof thirdSubmission.user === 'string'
						? thirdSubmission.user
						: thirdSubmission.user.id,
					submission: newGradings[2].submission.toString(),
					grade: newGradings[2].score,
					zValue: newGradings[2].zValue
				}
			}
		}

		// Create tournament with all required fields
		await TournamentModel.create({ 
			gradings: gradingIds, 
			disqualified,
			statistics,
			winners
		})

		res.status(201).send()
	} catch (error) {
		logger.error(error)
		res.status(400).json({ error: 'Invalid data' })
	}
}
