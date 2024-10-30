/* eslint-disable local/enforce-comment-order */

import { Action, StrategyFunction } from './types.js'

const gameState = (() => {
	let previousActions: Action[] = []
	let firstInRound: boolean = false
	let currentPlayerIndex: number = 0
	let players: StrategyFunction[] = []
	let playerLives: number[] = []
	let isTurnOver: boolean = false
	let hasRolled: boolean = false
	// Additional game state variables as needed

	return {
		getPreviousActions: () => [...previousActions],
		removePreviousAction: () => {
			previousActions.shift()
		},
		isFirstInRound: () => firstInRound,
		getCurrentPlayerIndex: () => currentPlayerIndex,
		setCurrentPlayerIndex: (index: number) => {
			currentPlayerIndex = index
		},
		getPlayers: () => players,
		setPlayers: (newPlayers: StrategyFunction[]) => {
			players = newPlayers
			playerLives = newPlayers.map(() => 6)
		},
		getPlayerLives: () => [...playerLives],
		modifyPlayerLife: (playerIndex: number, delta: number) => {
			playerLives[playerIndex] += delta
		},
		addAction: (action: Action) => {
			previousActions.unshift(action)
		},
		setFirstInRound: (value: boolean) => {
			firstInRound = value
		},
		getIsTurnOver: () => isTurnOver,
		setIsTurnOver: (value: boolean) => {
			isTurnOver = value
		},
		setHasRolled: (value: boolean) => {
			hasRolled = value
		},
		getHasRolled: () => hasRolled,
		setNextPlayerIndex: (value: number) => {
			currentPlayerIndex = value
		},
		getNextPlayerIndex: () => {
			return (currentPlayerIndex + 1) % players.length
		},
		endTurn: () => { // End of player turn
			isTurnOver = true
			currentPlayerIndex = (currentPlayerIndex + 1) % players.length
		},
		endRound: () => { // End of round
			firstInRound = true
			previousActions = []
			// Implement end of round logic
		}
		// Additional getters and setters as needed
	}
})()

export default gameState
