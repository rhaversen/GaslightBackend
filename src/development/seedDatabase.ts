/* eslint-disable local/enforce-comment-order */
// file deepcode ignore NoHardcodedPasswords/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore NoHardcodedCredentials/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore HardcodedNonCryptoSecret/test: Hardcoded credentials are only used for testing purposes

import SubmissionModel from '../app/models/Submission.js'
import TournamentModel from '../app/models/Tournament.js'
import UserModel from '../app/models/User.js'
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
const userCount = 10
const users = await Promise.all(
	Array(userCount).fill(null).map((_, i) => createRandomUser(i))
)

const allSubmissions = await Promise.all(
	users.map(user => createRandomSubmissions(user, Math.floor(Math.random() * 3) + 1))
)

// Create tournaments
const tournamentCount = 5
await Promise.all(
	Array(tournamentCount).fill(null).map(async () => {
		// Random selection of submissions for tournament
		const tournamentSubmissions = allSubmissions
			.flat()
			.filter(() => Math.random() > 0.5)
			.slice(0, Math.floor(Math.random() * 5) + 2)

		// Generate random scores first
		const scores = tournamentSubmissions.map(() => Math.random() * 1000)
		
		// Calculate statistics for Z-values
		const mean = scores.reduce((a, b) => a + b, 0) / scores.length
		const standardDeviation = Math.sqrt(
			scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
		)

		// Create gradings with proper Z-values
		const gradingDocs = await Promise.all(
			tournamentSubmissions.map((submission, index) => 
				GradingModel.create({
					submission: submission.id,
					score: scores[index],
					zValue: standardDeviation === 0 ? 0 : (scores[index] - mean) / standardDeviation
				})
			)
		)

		return TournamentModel.create({
			gradings: gradingDocs.map(g => g.id),
			tournamentExecutionTime: Math.floor(Math.random() * 60000) + 1000, // 1-60 seconds
			disqualified: tournamentSubmissions
				.filter(() => Math.random() > 0.9)
				.map(sub => ({
					submission: sub.id,
					reason: 'Random disqualification for testing'
				}))
		})
	})
)

logger.info(`Seeded database with ${userCount} users, ${allSubmissions.flat().length} submissions, and ${tournamentCount} tournaments`)
