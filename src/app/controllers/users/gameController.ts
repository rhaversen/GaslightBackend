// Node.js built-in modules

// Third-party libraries
import { type NextFunction, type Response, type Request } from 'express'
import mongoose from 'mongoose'

// Own modules
import logger from '../../utils/logger.js'
import GameModel from '../../models/Game.js'

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

		res.status(200).json(games)
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
		res.status(200).json(game)
	} catch (error) {
		if (error instanceof mongoose.Error.ValidationError) {
			res.status(400).json({ error: error.message })
			return
		}
		next(error)
	}
}
