import gameState from './gameState.js'
import { createStrategyAPI } from './strategyAPI.js'
import { type StrategyFunction } from './types.js'

export function startGame (strategies: StrategyFunction[]) {
	gameState.setPlayers(strategies)
	gameState.setFirstInRound(true)

	while (!isGameOver()) {
		gameState.setIsTurnOver(false) // Reset at the start of each turn

		const currentPlayerIndex = gameState.getCurrentPlayerIndex()
		const currentStrategy = gameState.getPlayers()[currentPlayerIndex]
		if (currentStrategy === undefined) {
			throw new Error(`No strategy for player index ${currentPlayerIndex}`)
		}
		const api = createStrategyAPI(currentPlayerIndex)

		while (!gameState.getIsTurnOver()) {
			// Execute the strategy
			try {
				currentStrategy(api)
			} catch (error) {
				// Strategies are user code — a throwing strategy must not stop
				// the tournament, so log and let the turn end.
				const message = error instanceof Error ? error.message : String(error)
				// eslint-disable-next-line no-console
				console.error(`Error in player ${currentPlayerIndex}'s strategy: ${message}`)
			}
		}
	// Announce the winner or handle end-of-game logic
	}
}

function isGameOver (): boolean {
	// Implement logic to determine if the game is over
	const playerLives = gameState.getPlayerLives()
	const activePlayers = playerLives.filter((lives) => lives > 0).length
	return activePlayers <= 1
}
