/* eslint-disable local/enforce-comment-order */
// file deepcode ignore NoHardcodedPasswords/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore NoHardcodedCredentials/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore HardcodedNonCryptoSecret/test: Hardcoded credentials are only used for testing purposes

import SubmissionModel from '../app/models/Submission.js'
import UserModel, { IUser } from '../app/models/User.js'
import logger from '../app/utils/logger.js'
import { processTournamentGradings } from '../app/controllers/microservices/codeRunnerController.js'
import GameModel from '../app/models/Game.js'
import meyerFiles, { apiType, detEllerDeroverStrategy, dumbStrategy, exampleStrategy, honestStrategy, lyingStrategy, revealingStrategy, statisticsStrategy } from './gamefiles.js'

logger.info('Seeding database')

// Create a single game using the source files from the external module
const game = await GameModel.create({
	name: 'Meyer',
	description: 'Meyer game built from GaslightCodeRunner source files',
	files: meyerFiles,
	apiType,
	exampleStrategy,
	batchSize: 10
})
const gameId = game.id as string

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
const generateExecutionTime = () => {
	// Random time between 0.1ms and 1ms
	return Math.random() * 0.9 + 0.1
}

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

	// First submission will be active and passed
	const activeStrategyName = strategyNames[Math.floor(Math.random() * strategyNames.length)] as keyof typeof strategies
	const activeSubmission = await SubmissionModel.create({
		title: `${activeStrategyName}_${Math.random().toString(36).substring(7)}`,
		code: strategies[activeStrategyName],
		user: user.id,
		active: true,
		passedEvaluation: true,
		game: gameId
	})
	submissions.push(activeSubmission)

	// Create remaining inactive submissions
	for (let i = 1; i < count; i++) {
		const strategyName = strategyNames[Math.floor(Math.random() * strategyNames.length)] as keyof typeof strategies
		const submission = await SubmissionModel.create({
			title: `${strategyName}_${Math.random().toString(36).substring(7)}`,
			code: strategies[strategyName],
			user: user.id,
			active: false,
			passedEvaluation: Math.random() > 0.3,
			game: gameId
		})
		submissions.push(submission)
	}
	return submissions
}

// Create users and their submissions
const userCount = 500
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

// Helper function to get valid tournament submissions
const getValidTournamentSubmissions = (submissions: any[], size: number) => {
	// Get only active and passed submissions
	const validSubmissions = submissions.flat().filter(sub =>
		sub.active && sub.passedEvaluation
	)

	// Group by user and take only one submission per user
	const submissionsByUser = validSubmissions.reduce((acc: any, submission: any) => {
		const userId = submission.user.toString()
		if (!acc[userId]) {
			acc[userId] = submission
		}
		return acc
	}, {})

	// Convert to array and shuffle
	return Object.values(submissionsByUser)
		.sort(() => Math.random() - 0.5)
		.slice(0, size)
}

// Create tournaments
const tournamentCount = 5
const submissionsPerTournament = 100
logger.info('Creating tournaments...')

for (let t = 0; t < tournamentCount; t++) {
	const tournamentSubmissions = getValidTournamentSubmissions(allSubmissions, submissionsPerTournament)

	// Generate disqualified submissions (5% chance)
	const disqualified = tournamentSubmissions
		.filter(() => Math.random() > 0.95)
		.map((sub: any) => ({
			submission: sub.id,
			reason: 'Random disqualification for testing'
		}))

	// Filter out disqualified submissions before creating scores
	const qualifiedSubmissions = tournamentSubmissions.filter((sub: any) => 
		!disqualified.some(d => d.submission === sub.id)
	)

	const scores = qualifiedSubmissions.map(() => generateScore())
	const submissionScores = qualifiedSubmissions.map((sub: any, index: number) => ({
		submission: sub.id,
		score: scores[index],
		avgExecutionTime: generateExecutionTime()
	}))

	await processTournamentGradings(
		submissionScores,
		disqualified,
		Math.floor(Math.random() * 60000) + 1000,
		gameId
	)

	logger.info(`Created tournament ${t + 1}/${tournamentCount} with ${qualifiedSubmissions.length} submissions (${disqualified.length} disqualified)`)
}

// Create three special tournaments where user1 has top scores
logger.info('Creating special tournaments for user1...')

const specialTournamentPositions = [1, 2, 3, 5, 20]
const user1 = users.find(u => u.email === 'user1@test.com') as IUser
const user1Submissions = allSubmissions[0]

// Update user1 submission selection to get only active and passed submissions
const user1ActiveSubmissions = user1Submissions?.filter(sub => sub.active && sub.passedEvaluation)
if (!user1ActiveSubmissions?.length) {
	logger.error('No active and passed submissions found for user1')
} else {
	for (const position of specialTournamentPositions) {
		// Get the active and passed submission from user1
		const user1Submission = user1ActiveSubmissions[0] // Use first valid submission

		// Get other valid submissions
		const otherValidSubmissions = allSubmissions
			.flat()
			.filter(s => 
				s.user.toString() !== user1.id && 
				s.active && 
				s.passedEvaluation
			)

		// Group by user and take one submission per user
		const submissionsByUser = otherValidSubmissions.reduce((acc, submission) => {
			const userId = submission.user.toString()
			if (!acc[userId]) {
				acc[userId] = submission
			}
			return acc
		}, {} as Record<string, any>)

		const uniqueUserSubmissions = Object.values(submissionsByUser)
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

		const submissionScores = allTournamentSubmissions.map((sub, index) => ({
			submission: sub.id,
			score: scores[index],
			avgExecutionTime: generateExecutionTime()
		}))

		await processTournamentGradings(
			submissionScores,
			[],
			Math.floor(Math.random() * 60000) + 1000,
			gameId
		)

		logger.info(`Created special tournament with user1 in position ${position}`)
	}
}

// Create tournaments with small numbers of submissions
logger.info('Creating small-sized tournaments...')
const smallSizes = [1, 2, 3, 5, 20]

for (const size of smallSizes) {
	// Select random submissions, ensuring one per user
	const shuffledSubmissions = Object.values(
		allSubmissions.flat().reduce((acc, submission) => {
			const userId = submission.user.toString()
			if (!acc[userId]) {
				acc[userId] = [submission]
			}
			return acc
		}, {} as Record<string, typeof allSubmissions[0]>)
	)
		.map(subs => subs[0])
		.sort(() => Math.random() - 0.5)
		.slice(0, size)

	// Generate scores for these submissions
	const scores = shuffledSubmissions.map(() => generateScore())

	const submissionScores = shuffledSubmissions.map((sub, index) => ({
		submission: sub.id,
		score: scores[index],
		avgExecutionTime: generateExecutionTime()
	}))

	await processTournamentGradings(
		submissionScores,
		[],
		Math.floor(Math.random() * 60000) + 1000,
		gameId
	)

	logger.info(`Created tournament with ${size} submission(s)`)
}

// Create one final large tournament with user1
logger.info('Creating final large tournament with user1...')

const finalTournamentSize = 500 // Large tournament
const user1FinalSubmission = user1ActiveSubmissions?.[0]
if (!user1FinalSubmission) {
	logger.error('No active and passed submission found for user1 final tournament')
} else {
	// Select random active and passed submissions from other users
	const otherValidSubmissions = Object.values(
		allSubmissions.flat()
			.filter(s => 
				s.user.toString() !== user1.id &&
				s.active &&
				s.passedEvaluation
			)
			.reduce((acc, submission) => {
				const userId = submission.user.toString()
				if (!acc[userId]) {
					acc[userId] = submission
				}
				return acc
			}, {} as Record<string, any>)
	)
		.sort(() => Math.random() - 0.5)
		.slice(0, finalTournamentSize - 1)

	const finalTournamentSubmissions = [user1FinalSubmission, ...otherValidSubmissions]

	// Generate scores for final tournament
	const finalScores = finalTournamentSubmissions.map(() => generateScore())
	const submissionScores = finalTournamentSubmissions.map((sub, index) => ({
		submission: sub.id,
		score: finalScores[index],
		avgExecutionTime: generateExecutionTime()
	}))

	await processTournamentGradings(
		submissionScores,
		[],
		Math.floor(Math.random() * 60000) + 1000,
		gameId
	)

	logger.info(`Created final large tournament with ${finalTournamentSize} submissions`)
}

logger.info(`Seeded database with ${userCount} users, ${allSubmissions.flat().length} submissions, and ${tournamentCount + smallSizes.length + specialTournamentPositions.length + 1} tournaments`)
