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
		tournamentExecutionTime
	} = req.body

	if (!Array.isArray(gradings)) {
		return res.status(400).json({ error: 'Gradings must be an array' })
	}

	try {
		// Calculate z-scores before insertion
		const scores = gradings.map(g => g.score).sort((a, b) => a - b)
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
		const gradingsSorted = newGradings.sort((a, b) => b.score - a.score)
		const gradingIds = gradingsSorted.map(grading => grading._id)

		// Get all submissions for the gradings
		const submissions = await SubmissionModel
			.find({ _id: { $in: gradingsSorted.map(g => g.submission) } })
			.populate('user', 'username')
			.exec() as ISubmissionPopulated[]

		const submissionMap = new Map(
			submissions.map(sub => [sub.id, sub])
		)

		// Calculate percentiles from original scores array
		scores.sort((a, b) => a - b)
		const percentiles = {
			p10: scores[Math.floor(scores.length * 0.10)],
			p25: scores[Math.floor(scores.length * 0.25)],
			p50: scores[Math.floor(scores.length * 0.50)],
			p75: scores[Math.floor(scores.length * 0.75)],
			p90: scores[Math.floor(scores.length * 0.90)]
		}
		const averageScore = mean
		const minMax = {
			min: Math.min(...scores),
			max: Math.max(...scores)
		}
		const iqr = percentiles.p75 - percentiles.p25
		const outlierBoundaries = {
			lower: percentiles.p25 - (1.5 * (percentiles.p75 - percentiles.p25)),
			upper: percentiles.p75 + (1.5 * (percentiles.p75 - percentiles.p25))
		}
		const outliers = scores.filter(score =>
			score < percentiles.p25 - (1.5 * (percentiles.p75 - percentiles.p25)) ||
			score > percentiles.p75 + (1.5 * (percentiles.p75 - percentiles.p25))
		)

		const statistics = {
			percentiles,
			averageScore,
			minMax,
			iqr,
			outlierBoundaries,
			outliers
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
		const firstSubmission = submissionMap.get(gradingsSorted[0].submission.toString())
		if (!firstSubmission?.user) {
			throw new Error('First place submission user not found')
		}

		const winners: Winners = {
			first: {
				user: typeof firstSubmission.user === 'string'
					? firstSubmission.user
					: firstSubmission.user.id,
				submission: gradingsSorted[0].submission.toString(),
				grade: gradingsSorted[0].score,
				zValue: gradingsSorted[0].zValue
			}
		}

		if (gradingsSorted.length > 1) {
			const secondSubmission = submissionMap.get(gradingsSorted[1].submission.toString())
			if (secondSubmission?.user) {
				winners.second = {
					user: typeof secondSubmission.user === 'string'
						? secondSubmission.user
						: secondSubmission.user.id,
					submission: gradingsSorted[1].submission.toString(),
					grade: gradingsSorted[1].score,
					zValue: gradingsSorted[1].zValue
				}
			}
		}

		if (gradingsSorted.length > 2) {
			const thirdSubmission = submissionMap.get(gradingsSorted[2].submission.toString())
			if (thirdSubmission?.user) {
				winners.third = {
					user: typeof thirdSubmission.user === 'string'
						? thirdSubmission.user
						: thirdSubmission.user.id,
					submission: gradingsSorted[2].submission.toString(),
					grade: gradingsSorted[2].score,
					zValue: gradingsSorted[2].zValue
				}
			}
		}

		// Create tournament with all required fields
		await TournamentModel.create({
			gradings: gradingIds,
			disqualified,
			statistics,
			winners,
			tournamentExecutionTime
		})

		res.status(201).send()
	} catch (error) {
		logger.error(error)
		res.status(400).json({ error: 'Invalid data' })
	}
}
