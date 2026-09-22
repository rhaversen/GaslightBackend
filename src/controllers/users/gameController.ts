import { type Request, type Response } from 'express'

import GameModel from '../../models/Game.js'
import SubmissionModel from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js'
import logger from '../../utils/logger.js'

export async function getAllGames (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting games')

	const { getTournaments } = req.query

	const games = await GameModel.find()
		.sort({ createdAt: -1 })
		.exec()

	// Get the count of active strategies for each game
	const strategyCounts = await Promise.all(
		games.map((game) =>
			SubmissionModel
				.countDocuments({ game: game.id, active: true })
				.exec()
		)
	)

	// Get latest tournaments if requested
	const tournaments = getTournaments === 'true'
		? await Promise.all(
			games.map((game) =>
				TournamentModel
					.findOne({ game: game.id })
					.sort({ createdAt: -1 })
					.exec()
			)
		)
		: games.map(() => undefined)

	// Sort by amount of active strategies
	const sortedGames = games.sort((a, b) => {
		const indexA = games.findIndex(g => g.id === a.id)
		const indexB = games.findIndex(g => g.id === b.id)
		return (strategyCounts[indexB] ?? 0) - (strategyCounts[indexA] ?? 0)
	})

	// Add the strategy count and tournament to the game object
	const mappedGames = sortedGames.map((game) => {
		const index = games.findIndex(g => g.id === game.id)

		return {
			_id: game.id,
			name: game.name,
			description: game.description,
			summary: game.summary,
			files: game.files,
			apiType: game.apiType,
			exampleStrategy: game.exampleStrategy,
			batchSize: game.batchSize,
			createdAt: game.createdAt,
			updatedAt: game.updatedAt,
			submissionCount: strategyCounts[index],
			latestTournament: tournaments[index]
		}
	})

	res.status(200).json(mappedGames)
}

export async function getGame (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Getting game')
	const { getTournaments } = req.query

	const game = await GameModel.findById(req.params.id)
	if (game === null) {
		throw new NotFoundError('Game not found')
	}

	// Get the count of active strategies for the game
	const strategyCount = await SubmissionModel
		.countDocuments({ game: game.id, active: true })
		.exec()

	// Get latest tournament if requested
	const tournament = getTournaments === 'true'
		? await TournamentModel
			.findOne({ game: game.id })
			.sort({ createdAt: -1 })
			.exec()
		: undefined

	// Add the strategy count and tournament to the game object
	const mappedGame = {
		_id: game.id,
		name: game.name,
		description: game.description,
		summary: game.summary,
		files: game.files,
		apiType: game.apiType,
		exampleStrategy: game.exampleStrategy,
		batchSize: game.batchSize,
		user: game.user,
		createdAt: game.createdAt,
		updatedAt: game.updatedAt,
		submissionCount: strategyCount,
		latestTournament: tournament
	}

	res.status(200).json(mappedGame)
}

const MAX_FILE_SIZE = 10000
const MAX_EXAMPLE_STRATEGY_SIZE = 10000

export async function createGame (
	req: Request,
	res: Response
): Promise<void> {
	logger.silly('Creating game')

	const user = req.user
	if (user === undefined) {
		throw new ForbiddenError('Unauthorized')
	}

	const { name, description, summary, files, apiType, exampleStrategy, batchSize } = req.body as Record<string, unknown>

	// Structural validation — Mongoose handles shape/required, these are
	// content rules a schema validator can't express.
	if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
		throw new ValidationError('Game name must be 1-100 characters')
	}
	if (typeof summary !== 'string' || summary.length > 100) {
		throw new ValidationError('Summary must be at most 100 characters')
	}
	if (typeof description !== 'string' || description.length > 5000) {
		throw new ValidationError('Description must be at most 5000 characters')
	}
	if (typeof batchSize !== 'number' || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
		throw new ValidationError('Batch size must be an integer between 1 and 20')
	}
	if (typeof files !== 'object' || files === null || typeof (files as Record<string, unknown>)['main.ts'] !== 'string') {
		throw new ValidationError('files must include a main.ts file')
	}
	const fileMap = files as Record<string, string>
	for (const [filename, content] of Object.entries(fileMap)) {
		if (typeof content !== 'string') {
			throw new ValidationError(`File ${filename} must be a string`)
		}
		if (content.length > MAX_FILE_SIZE) {
			throw new ValidationError(`File ${filename} exceeds ${MAX_FILE_SIZE} characters`)
		}
	}
	if (typeof exampleStrategy !== 'string' || exampleStrategy.length > MAX_EXAMPLE_STRATEGY_SIZE) {
		throw new ValidationError(`Example strategy must be at most ${MAX_EXAMPLE_STRATEGY_SIZE} characters`)
	}

	if (typeof apiType !== 'string' || apiType.length === 0) {
		throw new ValidationError('apiType must be a non-empty string')
	}

	const game = await GameModel.create({
		name: name.trim(),
		description,
		summary,
		files: fileMap,
		apiType,
		exampleStrategy,
		batchSize,
		user: user.id
	})

	res.status(201).json(game)
}
