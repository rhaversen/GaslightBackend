/* eslint-disable local/enforce-comment-order */

import { StrategyFunction } from './types.js'
import gameState from './gameState.js'
import { createStrategyAPI } from './strategyAPI.js'

export function startGame(strategies: StrategyFunction[]) {
	gameState.setPlayers(strategies)
	gameState.setFirstInRound(true)

	while (!isGameOver()) {
		gameState.setIsTurnOver(false) // Reset at the start of each turn

		const currentPlayerIndex = gameState.getCurrentPlayerIndex()
		const currentStrategy = gameState.getPlayers()[currentPlayerIndex]
		const api = createStrategyAPI(currentPlayerIndex)

		while (!gameState.getIsTurnOver()) {
			// Execute the strategy
			try {
				currentStrategy(api)
			} catch (error) {
				if (error instanceof Error) {
					console.error(`Error in player ${currentPlayerIndex}'s strategy: ${error.message}`)
				} else {
					console.error(`Error in player ${currentPlayerIndex}'s strategy: ${String(error)}`)
				}
			}
		}
	// Announce the winner or handle end-of-game logic
	}
}

function isGameOver(): boolean {
	// Implement logic to determine if the game is over
	const playerLives = gameState.getPlayerLives()
	const activePlayers = playerLives.filter((lives) => lives > 0).length
	return activePlayers <= 1
}
