import type { Game, Player } from '../commonTypes.d.ts'
import { PlayerError } from '../errors.ts'
import { callGuarded } from '../gameGuard.ts'

import { gameState } from './gameState.ts'
import { createStrategyAPI } from './strategyAPI.ts'
import { PlayerError as GamePlayerError } from './types.ts'

export class Main implements Game {
	private players: Player[] = []
	private isRoundActive = true
	private turnCount = 0

	init (players: Player[]) {
		gameState.init(players.map(player => player.submissionId))
		this.players = players
		this.isRoundActive = true
		this.turnCount = 0
	}

	playRound () {
		do {
			this.turnCount++
			if (this.turnCount > 100) {
				// Prevent infinite loops
				console.warn('Game is taking too long, stopping')
				this.isRoundActive = false
				break
			}

			const playerIndex = gameState.getCurrentPlayerIndex()
			const currentPlayer = this.players[playerIndex]
			if (currentPlayer === undefined) {
				throw new PlayerError('No strategy registered for the current player index.', 'unknown')
			}
			const api = createStrategyAPI(playerIndex, currentPlayer.submissionId)

			try {
				callGuarded(currentPlayer, api, currentPlayer.submissionId)
			} catch (error) {
				if (error instanceof GamePlayerError) {
					throw new PlayerError(error.message, currentPlayer.submissionId)
				}
				throw error
			}

			const canEndTurn = !gameState.isTurnActive() || gameState.hasPlayerRolled()
			if (!canEndTurn) {
				const lastAction = gameState.getTurnActions()[0]?.type || 'no action'
				throw new PlayerError(`You cannot end your turn after only doing '${lastAction}'. You must complete your turn with either 'reveal', 'det eller derover', or by announcing a value through calling "lie" or returning after a roll.`, this.players[playerIndex].submissionId)
			}
			const value = gameState.getTurnActions()[0]?.announcedValue || 0
			const prevValue = gameState.getRoundActions()[0]?.announcedValue || 0

			if (value < prevValue && value !== 0) {
				const lastAction = gameState.getTurnActions()[0]?.type
				throw new PlayerError(`Your ${lastAction} action announced ${value}, which is lower than the previous player's ${prevValue}. You must announce a higher value by lying, calling 'det eller derover', or reveal.`, this.players[playerIndex].submissionId)
			}

			// Check if the round is over
			// The game can run indefinitely, but we want to stop after a single round
			this.isRoundActive = gameState.isRoundActive()

			// Reset
			gameState.prepareNextTurn()
		} while (this.isRoundActive)
	}

	getResults () {
		return gameState.getResults()
	}

	getStats () {
		return {
			turnCount: this.turnCount
		}
	}
}

export default Main
