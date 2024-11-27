/* eslint-disable local/enforce-comment-order */

import gameState from './gameState.js'
import { DiePair, StrategyAPI } from './types.js'
import { rollDice , calculateScore } from './utils.js'


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
			if(gameState.getHasRolled()){
				//remove previous action and roll again
				gameState.removePreviousAction()	
			}
			const dice = rollDice()
			const score = calculateScore(dice)
			const previousAnnouncedValue = gameState.getPreviousActions()[0].announcedValue
			gameState.addAction({ type: 'detEllerDerover', value: score, playerIndex, announcedValue: previousAnnouncedValue })
			gameState.endTurn()

		},
		reveal: () => {
			ensureTurnActive()
			if (gameState.getHasRolled()) {
				throw new Error('Cannot reveal the previous player\'s action after rolling the dice.')
			}

			const previousPlayerIndex = (playerIndex + gameState.getPlayers().length - 1) % gameState.getPlayers().length

			const previousPlayerValue = gameState.getPreviousActions()[0].value
			const previousPlayerAnnouncedValue = gameState.getPreviousActions()[0].announcedValue

			const previousActionType = gameState.getPreviousActions()[0].type
			let previousPlayerLied = false
			if (previousActionType === 'roll') {
				previousPlayerLied = previousPlayerValue !== previousPlayerAnnouncedValue
			} else if (previousActionType === 'detEllerDerover') {
				previousPlayerLied = previousPlayerValue < previousPlayerAnnouncedValue
			}

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
			gameState.addAction({ type: 'roll', value: score, playerIndex, announcedValue: score })
			gameState.setHasRolled(true)
			return score
		},
		lie: (diePair: DiePair) => {
			ensureTurnActive()
			if (!gameState.getHasRolled()) {
				throw new Error('Cannot lie before rolling the dice.')
			}
			const realValue = gameState.getPreviousActions()[0].value
			const lieValue = calculateScore(diePair)

			gameState.removePreviousAction()
			gameState.addAction({ type: 'roll', value: realValue, playerIndex, announcedValue: lieValue })
			gameState.endTurn()
		},
	}
}
