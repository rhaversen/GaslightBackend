import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

import GameModel from '../../models/Game.js'
import SubmissionModel from '../../models/Submission.js'
import TournamentModel from '../../models/Tournament.js'
import logger from '../../utils/logger.js'

export async function getAllGames (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting games')

	try {
		const { getTournaments } = req.query

		const games = await GameModel.find()
			.sort({ createdAt: -1 })
			.exec()

		// Get the count of active strategies for each game
		const strategyCounts = await Promise.all(
			games.map((game) =>
				SubmissionModel
					.countDocuments({ game: game._id, active: true })
					.exec()
			)
		)

		// Get latest tournaments if requested
		const tournaments = getTournaments === 'true'
			? await Promise.all(
				games.map((game) =>
					TournamentModel
						.findOne({ game: game._id })
						.sort({ createdAt: -1 })
						.exec()
				)
			)
			: games.map(() => undefined)

		// Sort by amount of active strategies
		const sortedGames = games.sort((a, b) => {
			const indexA = games.findIndex(g => g.id === a.id)
			const indexB = games.findIndex(g => g.id === b.id)
			return strategyCounts[indexB] - strategyCounts[indexA]
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
	} catch (error) {
		if (error instanceof mongoose.Error.ValidationError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	}
}

export async function getGame (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting game')
	try {
		const { getTournaments } = req.query

		const game = await GameModel.findById(req.params.id)
		if (game === null) {
			res.status(404).json({ error: 'Game not found' })
			return
		}

		// Get the count of active strategies for the game
		const strategyCount = await SubmissionModel
			.countDocuments({ game: game._id, active: true })
			.exec()

		// Get latest tournament if requested
		const tournament = getTournaments === 'true'
			? await TournamentModel
				.findOne({ game: game._id })
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
			createdAt: game.createdAt,
			updatedAt: game.updatedAt,
			submissionCount: strategyCount,
			latestTournament: tournament
		}

		res.status(200).json(mappedGame)
	} catch (error) {
		if (error instanceof mongoose.Error.ValidationError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	}
}
