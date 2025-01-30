/* eslint-disable local/enforce-comment-order */
// file deepcode ignore NoHardcodedPasswords/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore NoHardcodedCredentials/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore HardcodedNonCryptoSecret/test: Hardcoded credentials are only used for testing purposes

import SubmissionModel from '../app/models/Submission.js'
import TournamentModel from '../app/models/Tournament.js'
import UserModel, { IUser } from '../app/models/User.js'
import GradingModel from '../app/models/Grading.js'
import logger from '../app/utils/logger.js'

logger.info('Seeding database')

const dumbStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// Randomly reveal
	if (Math.random() > 0.5) {
		api.reveal()
		return
	}

	// Get previous announced value
	const lastScore = api.getPreviousAction()

	// Roll the dice
	const currentScore = api.roll()

	// If our score is higher or equal, finish the turn
	if (lastScore === null || currentScore >= lastScore) {
		return
	}

	// If our score is lower, we can either lie or call "det eller derover"
	if (Math.random() > 0.5) {
		api.lie(lastScore)
	} else {
		api.detEllerDerover()
	}
}

export default main`

const honestStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// Get previous announced value
	const lastScore = api.getPreviousAction()

	// Roll the dice
	const currentScore = api.roll()

	// If our score is higher or equal, finish the turn
	if (lastScore === null || currentScore >= lastScore) {
		return
	}

	// If our score is lower, we call "det eller derover"
	api.detEllerDerover()
}

export default main`

const lyingStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// We always lie with maximum score
	api.roll()
	api.lie(1000)
}

export default main`

const statisticsStrategy = `const main = (api: MeyerStrategyAPI) => {
	// We'll try revealing or deciding on action before rolling if we want to accuse.
	// According to the error, we cannot reveal after rolling, so let's reveal first if needed.

	if (api.isFirstInRound()) {
		// If first in round, we must roll and that's all.
		api.roll()
		return
	}

	const lastScore = api.getPreviousAction()
	if (lastScore !== null) {
		// Compute probability distribution
		const allOutcomes: [number, number][] = []
		for (let d1 = 1; d1 <= 6; d1++) {
			for (let d2 = 1; d2 <= 6; d2++) {
				allOutcomes.push([d1, d2])
			}
		}

		const scores = allOutcomes.map(o => api.calculateDieScore(o))
		const total = scores.length
		// Count occurrences of each score
		const frequency: Record<number, number> = {}
		for (const s of scores) {
			frequency[s] = (frequency[s] ?? 0) + 1
		}
		// Sort scores ascending
		const uniqueScores = Object.keys(frequency).map(Number).sort((a, b) => a - b)

		// Probability of >= score: for each score, count outcomes >= that score
		// We'll create a helper function that given a score returns probability of rolling >= that score
		const probabilityAtLeast = (x: number) => {
			const validX = api.roundUpToValidScore(x)
			let count = 0
			for (const s of uniqueScores) {
				if (s >= validX) count += frequency[s]
			}
			return count / total
		}

		// If last score is extremely unlikely, reveal before rolling
		if (probabilityAtLeast(lastScore) < 0.2) {
			api.reveal()
			return
		}
	}

	// If we didn't reveal, now we roll
	const currentScore = api.roll()

	// If no last score or current >= last, do nothing
	if (lastScore === null || currentScore >= lastScore) return
	// We need to beat lastScore. Try to find a suitable lie:
	// Strategy:
	// 1. If gap small (<50), lying exactly at lastScore might be safe.
	// 2. Otherwise, try to find a score slightly higher than lastScore with decent probability.
	// 3. If no good plausible lie, fallback to detEllerDerover.

	const gap = lastScore - currentScore

	// If gap small, lie exactly at lastScore
	if (gap <= 50) {
		api.lie(lastScore)
		return
	}

	// Otherwise, det eller derover
	api.detEllerDerover()
}

export default main
`

const detEllerDeroverStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// We always call 'det eller derover'
	api.roll()
	api.detEllerDerover()
}

export default main
`

const revealingStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// We always reveal last turn
	api.reveal()
}

export default main
`

const strategies = {
	dumb: dumbStrategy,
	honest: honestStrategy,
	lying: lyingStrategy,
	statistics: statisticsStrategy,
	detEllerDerover: detEllerDeroverStrategy,
	revealing: revealingStrategy
}

// Helper functions for normal distribution
const normalRandom = () => {
	// Box-Muller transform for normal distribution
	const u1 = Math.random()
	const u2 = Math.random()
	const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
	return z
}

const normalRandomInRange = (mean: number, stdDev: number) => {
	const z = normalRandom()
	return mean + stdDev * z
}

const generateScore = () => {
	// 95% normal distribution, 5% outliers
	if (Math.random() > 0.05) {
		// Normal scores around 500 with stdDev 100
		return Math.max(0, normalRandomInRange(500, 100))
	} else {
		// Outliers: either very low or very high
		return Math.random() > 0.5 ? 
			normalRandomInRange(50, 25) :  // Very low scores
			normalRandomInRange(950, 25)  // Very high scores
	}
}

// Helper functions
const createRandomUser = async (index: number) => {
	const user = await UserModel.create({
		email: `user${index}@test.com`,
		password: 'password'
	})
	user.confirmUser()
	await user.save()
	return user
}

const createRandomSubmissions = async (user: any, count: number) => {
	const strategyNames = Object.keys(strategies)
	const submissions = []
  
	// Randomly select which submission will be active (if any)
	const activeIndex = Math.random() > 0.3 ? Math.floor(Math.random() * count) : -1
  
	for (let i = 0; i < count; i++) {
		const strategyName = strategyNames[Math.floor(Math.random() * strategyNames.length)] as keyof typeof strategies
		const submission = await SubmissionModel.create({
			title: `${strategyName}_${Math.random().toString(36).substring(7)}`,
			code: strategies[strategyName],
			user: user.id,
			active: i === activeIndex, // Only one submission will be active
			passedEvaluation: Math.random() > 0.3
		})
		submissions.push(submission)
	}
	return submissions
}

// Create users and their submissions
const userCount = 200  // Increased from 10
logger.info('Starting database seeding...')
logger.info('Creating users...')

const batchSize = 100
const users = []
for (let i = 0; i < userCount; i += batchSize) {
	const batch = await Promise.all(
		Array(Math.min(batchSize, userCount - i))
			.fill(null)
			.map((_, j) => createRandomUser(i + j + 1))  // +1 to skip index 1
	)
	users.push(...batch)
	logger.info(`Created users ${i + 1} to ${i + batch.length}`)
}

logger.info('Creating submissions...')
const allSubmissions = []
for (let i = 0; i < users.length; i += batchSize) {
	const userBatch = users.slice(i, i + batchSize)
	const submissionBatch = await Promise.all(
		userBatch.map(user => createRandomSubmissions(user, Math.floor(Math.random() * 5) + 1))
	)
	allSubmissions.push(...submissionBatch)
	logger.info(`Created submissions for users ${i + 1} to ${i + userBatch.length}`)
}

// Create tournaments
const tournamentCount = 10
const submissionsPerTournament = 100
logger.info('Creating tournaments...')

for (let t = 0; t < tournamentCount; t++) {
	// Group submissions by user
	const submissionsByUser = allSubmissions.flat().reduce((acc, submission) => {
		const userId = submission.user.toString()
		if (!acc[userId]) {
			acc[userId] = []
		}
		acc[userId].push(submission)
		return acc
	}, {} as Record<string, typeof allSubmissions[0]>)

	// Select one random submission per user
	const uniqueUserSubmissions = Object.values(submissionsByUser).map(
		userSubmissions => userSubmissions[Math.floor(Math.random() * userSubmissions.length)]
	)

	// Select random submissions, but ensure one per user
	const shuffledSubmissions = uniqueUserSubmissions
		.sort(() => Math.random() - 0.5)
		.slice(0, submissionsPerTournament)

	// Process gradings in batches to avoid memory issues
	const batchSize = 50
	const gradingDocs = []
	const scores = shuffledSubmissions.map(() => generateScore())
    
	// Calculate statistics for Z-values
	const mean = scores.reduce((a, b) => a + b, 0) / scores.length
	const standardDeviation = Math.sqrt(
		scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
	)

	// Calculate placements based on scores
	const sortedScores = [...scores].sort((a, b) => b - a)
	const placements = scores.map(score => sortedScores.indexOf(score) + 1)

	// Create gradings in batches
	for (let i = 0; i < shuffledSubmissions.length; i += batchSize) {
		const batchSubmissions = shuffledSubmissions.slice(i, i + batchSize)
		const batchScores = scores.slice(i, i + batchSize)
		const batchPlacements = placements.slice(i, i + batchSize)
        
		const batchGradings = await Promise.all(
			batchSubmissions.map((submission, index) => 
				GradingModel.create({
					submission: submission.id,
					score: batchScores[index],
					zValue: standardDeviation === 0 ? 0 : (batchScores[index] - mean) / standardDeviation,
					placement: batchPlacements[index]
				})
			)
		)
		gradingDocs.push(...batchGradings)
	}

	await TournamentModel.create({
		gradings: gradingDocs.map(g => g.id),
		tournamentExecutionTime: Math.floor(Math.random() * 60000) + 1000,
		disqualified: shuffledSubmissions
			.filter(() => Math.random() > 0.95) // 5% chance of disqualification
			.map(sub => ({
				submission: sub.id,
				reason: 'Random disqualification for testing'
			}))
	})

	logger.info(`Created tournament ${t + 1}/${tournamentCount} with ${submissionsPerTournament} submissions`)
}

// Create three special tournaments where user1 has top scores
logger.info('Creating special tournaments for user1...')

const user1 = users.find(u => u.email === 'user1@test.com') as IUser
const user1Submissions = allSubmissions[0]
if (!user1Submissions?.length) {
	logger.error('No submissions found for user1')
} else {
	const specialTournamentPositions = [1, 2, 3, 5, 10] // Added 5th and 10th positions
    
	for (const position of specialTournamentPositions) {
		// Get a random submission from user1
		const user1Submission = user1Submissions[Math.floor(Math.random() * user1Submissions.length)]
        
		// Group other submissions by user and select one per user
		const otherSubmissionsByUser = allSubmissions
			.flat()
			.filter(s => s.user.toString() !== user1.id)
			.reduce((acc, submission) => {
				const userId = submission.user.toString()
				if (!acc[userId]) {
					acc[userId] = []
				}
				acc[userId].push(submission)
				return acc
			}, {} as Record<string, typeof allSubmissions[0]>)

		const uniqueUserSubmissions = Object.values(otherSubmissionsByUser)
			.map(userSubmissions => userSubmissions[Math.floor(Math.random() * userSubmissions.length)])
			.sort(() => Math.random() - 0.5)
			.slice(0, submissionsPerTournament - 1)

		const allTournamentSubmissions = [user1Submission, ...uniqueUserSubmissions]

		// Generate scores where user1's submission is in the specified position from top
		const scores = allTournamentSubmissions.map((_, index) => {
			if (index === 0) { // user1's submission
				return normalRandomInRange(950 - (position - 1) * 10, 5) // High score with small variance
			} else {
				// Other submissions get scores that ensure they don't beat user1's position
				return index < position ? 
					normalRandomInRange(950 - (index - 1) * 10, 5) : // Higher scores
					normalRandomInRange(500, 100) // Normal scores
			}
		})

		// Calculate statistics and placements
		const mean = scores.reduce((a, b) => a + b, 0) / scores.length
		const standardDeviation = Math.sqrt(
			scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
		)
		const sortedScores = [...scores].sort((a, b) => b - a)
		const placements = scores.map(score => sortedScores.indexOf(score) + 1)

		// Create gradings with placements
		const gradingDocs = await Promise.all(
			allTournamentSubmissions.map((submission, index) =>
				GradingModel.create({
					submission: submission.id,
					score: scores[index],
					zValue: standardDeviation === 0 ? 0 : (scores[index] - mean) / standardDeviation,
					placement: placements[index]
				})
			)
		)

		await TournamentModel.create({
			gradings: gradingDocs.map(g => g.id),
			tournamentExecutionTime: Math.floor(Math.random() * 60000) + 1000,
			disqualified: []  // No disqualifications in these special tournaments
		})

		logger.info(`Created special tournament with user1 in position ${position}`)
	}
}

logger.info(`Seeded database with ${userCount} users, ${allSubmissions.flat().length} submissions, and ${tournamentCount} tournaments`)
