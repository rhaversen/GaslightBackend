// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import logger from '../../utils/logger.js'
import GameModel from '../../models/Game.js'
import TournamentModel from '../../models/Tournament.js'

// Environment variables
// Config variables
// Destructuring and global variables

export async function getAllGames(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting games')

	try {
		const games = await GameModel.find()
			.sort({ createdAt: -1 })
			.exec()

		// Get the latest tournament of each game
		const tournaments = await Promise.all(
			games.map((game) =>
				TournamentModel
					.findOne({ game: game._id })
					.sort({ createdAt: -1 })
					.exec()
			)
		)
		// Sort by amount of submissions in games latest tournament
		const sortedGames = games.sort((a, b) => {
			const tournamentA = tournaments.find(t => t?.game?.toString() === a.id)
			const tournamentB = tournaments.find(t => t?.game?.toString() === b.id)
			return (tournamentB?.gradings?.length || 0) - (tournamentA?.gradings?.length || 0)
		})

		// Add the latest tournament submission count to the game object
		const mappedGames = sortedGames.map((game) => {
			const tournament = tournaments.find(t => t?.game?.toString() === game.id)
			return {
				...game.toObject(),
				submissionCount: tournament?.gradings?.length || 0
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

export async function getGame(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	logger.silly('Getting game')
	try {
		const game = await GameModel.findById(req.params.id)
		if (game === null) {
			res.status(404).json({ error: 'Game not found' })
			return
		}

		// Get the latest tournament of the game
		const tournament = await TournamentModel
			.findOne({ game: game._id })
			.sort({ createdAt: -1 })
			.exec()
		
		// Add the latest tournament submission count to the game object
		const mappedGame = {
			...game.toObject(),
			submissionCount: tournament?.gradings?.length || 0
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
