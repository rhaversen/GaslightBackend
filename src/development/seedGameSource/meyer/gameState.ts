import { Action } from './types.ts'

class GameState {
	private static instance: GameState
	private roundActions: Action[] = []
	private turnActions: Action[] = []
	private firstInRound = true
	private currentPlayerIndex = 0
	private amountOfPlayers = 0
	private hasRolled = false
	private scoring: Map<string, number> = new Map()
	private turnActive = true
	private roundActive = true
	private playerIds: string[] = []

	static getInstance (): GameState {
		if (!GameState.instance) {
			GameState.instance = new GameState()
		}
		return GameState.instance
	}

	init (ids: string[]) {
		this.roundActions = []
		this.turnActions = []
		this.firstInRound = true
		this.currentPlayerIndex = 0
		this.amountOfPlayers = ids.length
		this.hasRolled = false
		this.scoring = new Map(ids.map(id => [id, 0]))
		this.turnActive = true
		this.roundActive = true
		this.playerIds = [...ids]
	}

	addTurnAction (action: Action): void {
		this.turnActions.unshift(action)
	}

	penalizePlayer (playerIndex: number): void {
		const playerId = this.playerIds[playerIndex]
		const currentScore = this.scoring.get(playerId)!
		this.scoring.set(playerId, currentScore - 1)
	}

	doublePenalizePlayer (playerIndex: number): void {
		const playerId = this.playerIds[playerIndex]
		const currentScore = this.scoring.get(playerId)!
		this.scoring.set(playerId, currentScore - 2)
	}

	// Getters and setters
	getTurnActions (): Action[] {
		return [...this.turnActions]
	}

	getRoundActions (): Action[] {
		return [...this.roundActions]
	}

	removePreviousTurnAction (): void {
		this.turnActions.shift()
	}

	isFirstInRound (): boolean {
		return this.firstInRound
	}

	getPlayerId (playerIndex: number): string | undefined {
		return this.playerIds[playerIndex]
	}

	getCurrentPlayerIndex (): number {
		return this.currentPlayerIndex
	}

	getPrevPlayerIndex (): number {
		return (this.currentPlayerIndex - 1 + this.amountOfPlayers) % this.amountOfPlayers
	}

	hasPlayerRolled (): boolean {
		return this.hasRolled
	}

	setHasRolled (value: boolean): void {
		this.hasRolled = value
	}

	incrementCurrentPlayerIndex (): void {
		this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.amountOfPlayers
	}

	endTurn (): void {
		this.turnActive = false
	}

	endRound (): void {
		this.turnActive = false
		this.roundActive = false
	}

	isTurnActive (): boolean {
		return this.turnActive
	}

	isRoundActive (): boolean {
		return this.roundActive
	}

	prepareNextTurn (): void {
		if (this.roundActive) {
			// If the round is still active, we only need to prepare the next player
			this.firstInRound = false
			// Move the final action of the turn to the previous actions
			const finalAction = this.turnActions[0]
			this.roundActions.unshift(finalAction)
		} else {
			// If the round is over, we need to reset the round and prepare the next player
			this.firstInRound = true
			this.roundActions = []
			this.roundActive = true
		}
		// Reset turn-specific variables
		this.hasRolled = false
		this.turnActive = true
		this.turnActions = []

		// Increment the current player index
		this.incrementCurrentPlayerIndex()
	}

	getResults () {
		return this.scoring
	}
}

export const gameState = GameState.getInstance()
