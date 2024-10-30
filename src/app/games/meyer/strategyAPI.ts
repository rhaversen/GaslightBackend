/* eslint-disable local/enforce-comment-order */

import { DiePair, StrategyAPI } from './types.js'
import gameState from './gameState.js'
import { rollDice } from './utils.js'
import { calculateScore } from './utils.js'

export function createStrategyAPI(playerIndex: number): StrategyAPI {
	function ensureTurnActive() {
		if (gameState.getCurrentPlayerIndex() !== playerIndex) {
			throw new Error('Turn has ended, no further API calls are allowed.')
		}
	}

	return {
		getPreviousActions: () => {
			ensureTurnActive()
			return gameState.getPreviousActions()
		},
		isFirstInRound: () => {
			ensureTurnActive()
			return gameState.isFirstInRound()
		},
		detEllerDerover: () => {
			ensureTurnActive()
			const dice = rollDice()
			const score = calculateScore(dice)
			gameState.addAction({ type: 'detEllerDerover', value: score, playerIndex })
			gameState.endTurn()
		},
		reveal: () => {
			ensureTurnActive()
			if (gameState.getHasRolled()) {
				throw new Error('Cannot reveal the previous player\'s action after rolling the dice.')
			}

			// Previous player could have detEllerDerover or roll
			// If the previous player had detEllerDerover, find the last roll action
			// If the previous player had roll, the previous action is the score

			// Find the last roll action
			let lastRoll = null
			for (const action of gameState.getPreviousActions()) {
				if (action.type === 'roll') {
					lastRoll = action
					break
				}
			}

			if (lastRoll === null) {
				throw new Error('No previous action to reveal (First player in the round called detEllerDerover).')
			}

			const previousPlayerIndex = (playerIndex + gameState.getPlayers().length - 1) % gameState.getPlayers().length
			const previousPlayerValue = gameState.getPreviousActions()[0].value
			const previousPlayerLied = lastRoll.value > previousPlayerValue

			if (previousPlayerLied) {
				gameState.modifyPlayerLife(previousPlayerIndex, -1)
				gameState.setCurrentPlayerIndex(previousPlayerIndex)
				gameState.endRound()
				
			} else {
				gameState.modifyPlayerLife(playerIndex, -1)
				gameState.setCurrentPlayerIndex(playerIndex)
				gameState.endRound()

			}
		},
		roll: () => {
			ensureTurnActive()
			const dice = rollDice()
			const score = calculateScore(dice)
			gameState.addAction({ type: 'roll', value: score, playerIndex })
			gameState.setHasRolled(true)
			return score
		},
		lie: (diePair: DiePair) => {
			ensureTurnActive()
			if (!gameState.getHasRolled()) {
				throw new Error('Cannot lie before rolling the dice.')
			}
			const actionValue = calculateScore(diePair)
			gameState.addAction({ type: 'roll', value: actionValue, playerIndex })
			gameState.endTurn()
		},
	}
}
