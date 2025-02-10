/* eslint-disable local/enforce-comment-order */
// file deepcode ignore NoHardcodedPasswords/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore NoHardcodedCredentials/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore HardcodedNonCryptoSecret/test: Hardcoded credentials are only used for testing purposes

import SubmissionModel from '../app/models/Submission.js'
import UserModel from '../app/models/User.js'
import logger from '../app/utils/logger.js'
import { processTournamentGradings } from '../app/controllers/microservices/codeRunnerController.js'
import GameModel from '../app/models/Game.js'
import meyerFiles, { apiType, detEllerDeroverStrategy, dumbStrategy, exampleStrategy, honestStrategy, lyingStrategy, revealingStrategy, statisticsStrategy } from './gamefiles.js'

logger.info('Seeding database')

// Create multiple games with different names
const games = await Promise.all([
	GameModel.create({
		name: 'Meyer1',
		description: 'Meyer1 game built from GaslightCodeRunner source files',
		files: meyerFiles,
		apiType,
		exampleStrategy,
		batchSize: 10
	}),
	GameModel.create({
		name: 'Meyer2',
		description: 'Meyer2 game built from GaslightCodeRunner source files',
		files: meyerFiles,
		apiType,
		exampleStrategy,
		batchSize: 20
	}),
	GameModel.create({
		name: 'Meyer3',
		description: 'Meyer3 game built from GaslightCodeRunner source files',
		files: meyerFiles,
		apiType,
		exampleStrategy,
		batchSize: 15
	})
])
const gameIds = games.map(game => game.id as string)

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

// Modify createRandomSubmissions to include game name in title
const createRandomSubmissions = async (user: any, count: number, gameId: string, gameName: string) => {
	const strategyNames = Object.keys(strategies)
	const submissions = []

	// First submission will be active and passed
	const activeStrategyName = strategyNames[Math.floor(Math.random() * strategyNames.length)] as keyof typeof strategies
	const activeSubmission = await SubmissionModel.create({
		title: `${gameName}_${activeStrategyName}_${Math.random().toString(36).substring(7)}`,
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
			title: `${gameName}_${strategyName}_${Math.random().toString(36).substring(7)}`,
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

// Create users and their submissions for all games
const userCount = 500
logger.info('Starting database seeding...')
logger.info('Creating users...')

const batchSize = 100
const users = []
// Store submissions separately per game
const allSubmissions: any[][] = Array(games.length).fill(null).map(() => [])

// Create user1 first and ensure they have submissions
logger.info('Creating user1...')
const user1 = await createRandomUser(1)
await Promise.all(games.map(async (game, index) => {
	const user1Subs = await createRandomSubmissions(user1, 1, gameIds[index], game.name)
	allSubmissions[index].push(user1Subs)
}))

// Create remaining users starting from index 2
for (let i = 0; i < userCount - 1; i += batchSize) {
	const batch = await Promise.all(
		Array(Math.min(batchSize, userCount - 1 - i))
			.fill(null)
			.map((_, j) => createRandomUser(i + j + 2))  // Start from index 2
	)
	users.push(batch)
	// For each user, create submissions for each game and aggregate
	for (const user of batch) {
		await Promise.all(games.map(async (game, index) => {
			const subs = await createRandomSubmissions(user, Math.floor(Math.random() * 5) + 1, gameIds[index], game.name)
			allSubmissions[index].push(subs)
		}))
	}
	logger.info(`Created users ${i + 1} to ${i + batch.length}`)
}

logger.info('Creating submissions...')

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

// Helper to flatten array of arrays
const flatten = (arr: any[]) => arr.flat()

// Helper function to ensure user1 has at least one active and passed submission for a game
const ensureUser1Submission = async (user: any, gameId: string, gameName: string, allSubs: any[]) => {
	// Use user.id for filtering instead of user.email
	let userSubs = flatten(allSubs).filter(sub => sub.user.toString() === user.id.toString() && sub.active && sub.passedEvaluation)
	if (!userSubs.length) {
		// Create one submission if none exists
		const newSubs = await createRandomSubmissions(user, 1, gameId, gameName)
		allSubs.push(newSubs)
		userSubs = flatten(allSubs).filter(sub => sub.user.toString() === user.id.toString() && sub.active && sub.passedEvaluation)
	}
	return userSubs
}

// Ensure user1 submissions exist for all games before special tournaments
await Promise.all(games.map(async (game, index) => {
	await ensureUser1Submission(user1, gameIds[index], game.name, allSubmissions[index])
}))

// Update user1 submission filtering to use ID
const user1Submissions = games.map((game, index) => flatten(allSubmissions[index]).filter(sub =>
	sub.user.toString() === user1.id.toString() &&
	sub.active &&
	sub.passedEvaluation
))

// Create tournaments
const tournamentCount = 5
const submissionsPerTournament = 100
logger.info('Creating tournaments...')

for (let t = 0; t < tournamentCount; t++) {
	// Alternate tournaments between games
	const gameIndex = t % games.length
	const currentGameId = gameIds[gameIndex]
	const submissionsPool = flatten(allSubmissions[gameIndex])
	const tournamentSubmissions = getValidTournamentSubmissions(submissionsPool, submissionsPerTournament)

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
		currentGameId // changed: use current game id
	)

	logger.info(`Created tournament ${t + 1}/${tournamentCount} for ${games[gameIndex].name} with ${qualifiedSubmissions.length} submissions (${disqualified.length} disqualified)`)
}

// Create three special tournaments where user1 has top scores
logger.info('Creating special tournaments for user1...')

const specialTournamentPositions = [1, 2, 3, 5, 20]

for (let i = 0; i < specialTournamentPositions.length; i++) {
	const gameIndex = i % games.length
	const currentGameId = gameIds[gameIndex]
	const user1SubmissionsForGame = user1Submissions[gameIndex]
	if (!user1SubmissionsForGame?.length) {
		logger.error('No active and passed submissions found for user1 for current game')
		continue
	}
	const user1Submission = user1SubmissionsForGame[0]
	const submissionsPool = flatten(allSubmissions[gameIndex])
	const otherValidSubmissions = submissionsPool.filter(s =>
		s.user.toString() !== user1.id.toString() &&
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
			return normalRandomInRange(950 - (specialTournamentPositions[i] - 1) * 10, 5) // High score with small variance
		} else {
			// Other submissions get scores that ensure they don't beat user1's position
			return index < specialTournamentPositions[i] ?
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
		currentGameId // changed: use game id
	)

	logger.info(`Created special tournament for ${games[gameIndex].name} with user1 in position ${specialTournamentPositions[i]}`)
}

// Create tournaments with small numbers of submissions
logger.info('Creating small-sized tournaments...')
const smallSizes = [1, 2, 3, 5, 20]

smallSizes.forEach(async (size, index) => {
	const gameIndex = index % games.length
	const currentGameId = gameIds[gameIndex]
	const submissionsPool = flatten(allSubmissions[gameIndex])
	const submissionsByUser = submissionsPool.reduce<Record<string, typeof submissionsPool[0][]>>((acc, submission) => {
		const userId = submission.user.toString()
		if (!acc[userId]) {
			acc[userId] = [submission]
		}
		return acc
	}, {})
	const shuffledSubmissions = Object.values(submissionsByUser)
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
		currentGameId // changed: use current game id
	)

	logger.info(`Created tournament for ${games[gameIndex].name} with ${size} submission(s)`)
})

// Create one final large tournament with user1
logger.info('Creating final large tournament with user1...')

// For each game, create a final large tournament with a slightly random number of submissions
await Promise.all(games.map(async (game, index) => {
	const user1FinalSub = user1Submissions[index]?.[0]
	if (!user1FinalSub) {
		logger.error(`No active and passed submission found for user1 for ${game.name} final tournament`)
		return
	}
	const submissionsPool = flatten(allSubmissions[index])
	const otherValidSubmissions = submissionsPool.filter(s =>
		s.user.toString() !== user1.id.toString() &&
		s.active &&
		s.passedEvaluation
	)

	const submissionsByUser = otherValidSubmissions.reduce((acc, submission) => {
		const userId = submission.user.toString()
		if (!acc[userId]) {
			acc[userId] = submission
		}
		return acc
	}, {} as Record<string, any>)

	const uniqueSubmissions = Object.values(submissionsByUser)
		.sort(() => Math.random() - 0.5)
		.slice(0, Math.floor(Math.random() * 100) + 400) // Random number between 400 and 500

	const finalTournamentSubmissions = [user1FinalSub, ...uniqueSubmissions]

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
		gameIds[index] // changed: use game id
	)

	logger.info(`Created final large tournament for ${game.name} with ${finalTournamentSubmissions.length} submissions`)
}))

logger.info(`Seeded database with ${userCount} users, ${allSubmissions.flat().length} submissions, and ${tournamentCount + smallSizes.length + specialTournamentPositions.length + games.length} tournaments`)
