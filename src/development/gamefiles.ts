/* eslint-disable local/enforce-comment-order */
const meyerFiles = {
	'gameState.ts': `import { Action } from './types.ts'

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

	static getInstance(): GameState {
		if (!GameState.instance) {
			GameState.instance = new GameState()
		}
		return GameState.instance
	}

	init(ids: string[]) {
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

	addTurnAction(action: Action): void {
		this.turnActions.unshift(action)
	}

	penalizePlayer(playerIndex: number): void {
		const playerId = this.playerIds[playerIndex]
		const currentScore = this.scoring.get(playerId)!
		this.scoring.set(playerId, currentScore - 1)
	}

	doublePenalizePlayer(playerIndex: number): void {
		const playerId = this.playerIds[playerIndex]
		const currentScore = this.scoring.get(playerId)!
		this.scoring.set(playerId, currentScore - 2)
	}

	// Getters and setters
	getTurnActions(): Action[] {
		return [...this.turnActions]
	}

	getRoundActions(): Action[] {
		return [...this.roundActions]
	}

	removePreviousTurnAction(): void {
		this.turnActions.shift()
	}

	isFirstInRound(): boolean {
		return this.firstInRound
	}

	getCurrentPlayerIndex(): number {
		return this.currentPlayerIndex
	}

	getPrevPlayerIndex(): number {
		return (this.currentPlayerIndex - 1 + this.amountOfPlayers) % this.amountOfPlayers
	}

	hasPlayerRolled(): boolean {
		return this.hasRolled
	}

	setHasRolled(value: boolean): void {
		this.hasRolled = value
	}

	incrementCurrentPlayerIndex(): void {
		this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.amountOfPlayers
	}

	endTurn(): void {
		this.turnActive = false
	}

	endRound(): void {
		this.turnActive = false
		this.roundActive = false
	}

	isTurnActive(): boolean {
		return this.turnActive
	}

	isRoundActive(): boolean {
		return this.roundActive
	}

	prepareNextTurn(): void {
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

	getResults() {
		return this.scoring
	}
}

export const gameState = GameState.getInstance()`,

	'main.ts': `import type { Game, Player } from './commonTypes.d.ts'
import { gameState } from './gameState.ts'
import { createStrategyAPI } from './strategyAPI.ts'
import { PlayerError as GamePlayerError } from './types.ts'
import { PlayerError } from './errors.ts'

export class Main implements Game {
	private players: Player[] = []
	private isRoundActive = true
	private turnCount = 0

	init(players: Player[]) {
		gameState.init(players.map(player => player.submissionId))
		this.players = players
		this.isRoundActive = true
		this.turnCount = 0
	}

	playRound() {
		do {
			this.turnCount++
			if (this.turnCount > 100) {
				console.warn('Game is taking too long, stopping')
				this.isRoundActive = false
				break
			}

			const playerIndex = gameState.getCurrentPlayerIndex()
			const api = createStrategyAPI(playerIndex)
			try {
				this.players[playerIndex].strategy(api)
			} catch (error) {
				if (error instanceof GamePlayerError) {
					throw new PlayerError(error.message, this.players[playerIndex].submissionId)
				}
			}

			const canEndTurn = !gameState.isTurnActive() || gameState.hasPlayerRolled()
			if (!canEndTurn) {
				const lastAction = gameState.getTurnActions()[0]?.type || 'no action'
				throw new PlayerError(\`You cannot end your turn after only doing '\${lastAction}'. You must complete your turn with either 'reveal', 'det eller derover', or by announcing a value.\`, this.players[playerIndex].submissionId)
			}
			const value = gameState.getTurnActions()[0]?.announcedValue || 0
			const prevValue = gameState.getRoundActions()[0]?.announcedValue || 0

			if (value < prevValue && value !== 0) {
				const lastAction = gameState.getTurnActions()[0]?.type
				throw new PlayerError(\`Your \${lastAction} action announced \${value}, which is lower than the previous player's \${prevValue}.\`, this.players[playerIndex].submissionId)
			}

			this.isRoundActive = gameState.isRoundActive()
			gameState.prepareNextTurn()
		} while (this.isRoundActive)
	}

	getResults() {
		return gameState.getResults()
	}

	getStats() {
		return {
			turnCount: this.turnCount
		}
	}
}

export default Main`,

	'strategyAPI.ts': `import { gameState } from './gameState.ts'
import { MeyerStrategyAPI, DiePair, PlayerError } from './types.ts'
import { calculateScore, isValidScore, rollDice, roundUpToValidScore } from './utils.ts'

export function createStrategyAPI(playerIndex: number): MeyerStrategyAPI {
	const ensureTurnActive = () => {
		if (!gameState.isTurnActive()) {
			throw new PlayerError('Your turn has ended. You can only perform one action to end your turn.', playerIndex)
		}
	}

	return {
		calculateDieScore: (dice: DiePair) => {
			if (!dice || !Array.isArray(dice) || dice.length !== 2) {
				throw new PlayerError('Invalid dice pair provided. Must be an array of exactly two numbers.', playerIndex)
			}
			if (!dice.every(die => Number.isInteger(die) && die >= 1 && die <= 6)) {
				throw new PlayerError('Invalid dice pair provided. Each die must be between 1 and 6.', playerIndex)
			}
			return calculateScore(dice)
		},
		getPreviousActions: () => {
			ensureTurnActive()
			const actions = gameState.getRoundActions()
			if (actions.length === 0) {
				return null
			}
			return actions.map(action => action.announcedValue)
		},
		getPreviousAction: () => {
			ensureTurnActive()
			const actions = gameState.getRoundActions()
			if (actions.length === 0) {
				return null
			}
			return actions[0].announcedValue
		},
		roundUpToValidScore: (score: number) => {
			ensureTurnActive()
			if (score > 1000) {
				throw new PlayerError('Score exceeds maximum of 1000.', playerIndex)
			}
			return roundUpToValidScore(score)
		},
		isFirstInRound: () => {
			ensureTurnActive()
			return gameState.isFirstInRound()
		},
		detEllerDerover: () => {
			ensureTurnActive()
			if (!gameState.hasPlayerRolled()) {
				throw new PlayerError('You must roll before calling "det eller derover".', playerIndex)
			}
			if (gameState.isFirstInRound()) {
				throw new PlayerError('As first player you cannot call "det eller derover".', playerIndex)
			}
			const prevAction = gameState.getRoundActions()[0]
			if (!prevAction) {
				throw new PlayerError('No previous action to match.', playerIndex)
			}
			const dice = rollDice()
			const score = calculateScore(dice)
			const previousAnnouncedValue = prevAction.announcedValue
			gameState.addTurnAction({
				type: 'detEllerDerover',
				value: score,
				playerIndex,
				announcedValue: previousAnnouncedValue
			})
			gameState.endTurn()
		},
		reveal: () => {
			ensureTurnActive()
			if (gameState.hasPlayerRolled()) {
				throw new PlayerError('You can only reveal as your first action.', playerIndex)
			}
			const prevPlayerIndex = gameState.getPrevPlayerIndex()
			const prevAction = gameState.getRoundActions()[0]
			if (!prevAction) {
				throw new PlayerError('Cannot reveal as no previous action exists.', playerIndex)
			}
			const prevPlayerLied = prevAction.value < prevAction.announcedValue
			const prevAnnouncedValueIsMeyer = prevAction.announcedValue === 1000
			const prevValueIsMeyer = prevAction.value === 1000
			if (prevPlayerLied) {
				if (prevAnnouncedValueIsMeyer) {
					gameState.doublePenalizePlayer(prevPlayerIndex)
				} else {
					gameState.penalizePlayer(prevPlayerIndex)
				}
			} else {
				if (prevValueIsMeyer) {
					gameState.doublePenalizePlayer(playerIndex)
				} else {
					gameState.penalizePlayer(playerIndex)
				}
			}
			gameState.endRound()
		},
		roll: () => {
			ensureTurnActive()
			if (gameState.hasPlayerRolled()) {
				throw new PlayerError('You can only roll once per turn.', playerIndex)
			}
			const dice = rollDice()
			const score = calculateScore(dice)
			gameState.addTurnAction({
				type: 'roll',
				value: score,
				playerIndex,
				announcedValue: score
			})
			gameState.setHasRolled(true)
			return score
		},
		lie: (score: number) => {
			ensureTurnActive()
			if (!gameState.hasPlayerRolled()) {
				throw new PlayerError('Roll before lying.', playerIndex)
			}
			const lieValue = score
			const realValue = gameState.getTurnActions()[0].value
			const prevTurnValue = gameState.getRoundActions()[0]?.announcedValue || 0
			if (!isValidScore(lieValue)) {
				throw new PlayerError(\`The announced value \${lieValue} is invalid.\`, playerIndex)
			}
			if (lieValue < prevTurnValue) {
				throw new PlayerError(\`Announced value must be higher than \${prevTurnValue}.\`, playerIndex)
			}
			gameState.addTurnAction({
				type: 'lie',
				value: realValue,
				playerIndex,
				announcedValue: lieValue
			})
			gameState.endTurn()
		}
	}
}`,

	'types.ts': `export class PlayerError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PlayerError'
	}
}

export type DiePair = [number, number];
export type ActionType = 'detEllerDerover' | 'roll' | 'lie';

export interface Action {
	type: ActionType;
	value: number;
	announcedValue: number;
	playerIndex: number;
}`,

	'utils.ts': `export function rollDice(): [number, number] {
	const randomDie = () => Math.floor(Math.random() * 6) + 1
	return [randomDie(), randomDie()]
}

export function calculateScore(dice: [number, number]): number {
	const [die1, die2] = dice.sort((a, b) => b - a)
	if ((die1 === 2 && die2 === 1)) return 1000 // Meyer
	if ((die1 === 3 && die2 === 1)) return 999  // Lille-meyer
	if (die1 === die2) return die1 * 100        // Pairs
	return die1 * 10 + die2                     // Regular scores
}

const validScores = new Set<number>([
	1000, 999,
	600, 500, 400, 300, 200, 100,
	65, 64, 63, 62, 61,
	54, 53, 52, 51,
	43, 42, 41,
	32,
])

export function isValidScore(score: number): boolean {
	return validScores.has(score)
}

export function roundUpToValidScore(score: number): number {
	const validScoresAscending = [...validScores].sort((a, b) => a - b)
	for (const validScore of validScoresAscending) { 
		if (score <= validScore) return validScore
	}
	return 0
}`
}

export const exampleStrategy = `const main = (api: MeyerStrategyAPI) => {
	// YOUR CODE HERE

	// This is an example strategy
	// It will make some naive decisions based on the current state of the game
	// You can use this as a starting point for your own strategy or write your own from scratch

	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		// We can't make any more actions the first turn, so we return
		return
	}

	// Get previous announced values
	const lastScores = api.getPreviousActions()

	// If the last score is a pair or larger, reveal
	if (lastScores !== null && lastScores[0] >= 100) {
		api.reveal()
		// We can't make any more actions after revealing, so we return
		return
	}

	// If the previous player called the same score as the player before them, reveal
	if (lastScores !== null && lastScores[0] === lastScores[1]) {
		api.reveal()
		return
	}

	// Roll the dice
	const currentScore = api.roll()

	// If our score is higher or equal, finish the turn
	if (lastScores === null || currentScore >= lastScores[0]) {
		return
	}

	// If our score is lower, we can either lie or call "det eller derover"
	if (Math.random() > 0.5) {
		api.lie(lastScores[0])
		// We cant make any more actions after lying
	} else {
		api.detEllerDerover()
		// We cant make any more actions after calling "det eller derover"
	}

	// END CODE
}

export default main`

export const apiType = `/**
 * Possible scores in Meyer:
 *
 * Special scores
 * 1000, 999 (Meyer and Lille Meyer)
 * 
 *
 * Pairs
 * 600, 500, 400, 300, 200, 100
 * 
 * Regular scores
 * 65, 64, 63, 62, 61
 * 54, 53, 52, 51
 * 43, 42, 41
 * 32
*/

interface MeyerStrategyAPI {
	/**
	 * @param dice - A pair of dice
	 * @returns The score of the dice
	 * @description
	 * Will always return the highest possible score for the given dice.
	 */
	calculateDieScore: (dice: [number, number]) => number;
	/**
	 * @returns Array of newest to oldest previous actions
	 * @description
	 * Will only reveal the announced value (possible lie) of the previous actions.
	 * The value of the action is the calculated score of the dice.
	 * If there are no previous actions, null will be returned.
	 * If the player has already rolled the dice, the previous action will be the roll action.
	 */
	getPreviousActions: () => number[] | null;
	/**
	 * @returns The previous action
	 * @description
	 * Will only reveal the announced value (possible lie) of the previous action.
	 * The value of the action is the calculated score of the dice.
	 * If there are no previous actions, null will be returned.
	 * If the player has already rolled the dice, the previous action will be the roll action.
	 */
	getPreviousAction: () => number | null;
	/**
	 * @param score - The score to round up
	 * @returns The rounded up score
	 * @description
	 * Rounds up the score to the nearest valid score.
	 */
	roundUpToValidScore: (score: number) => number;
	/**
	 * @returns Whether the player is the first in the round
	 */
	isFirstInRound: () => boolean;
	/**
	 * @description
	 * Ends the turn by rolling the dice while hiding the result from both the current player and the other players.
	 * The announced value will be the score of the previous action (Essentially betting that the hidden score is higher than or equal to the previous action).
	 * Can only be called once per turn and only if the player is not the first in the round. Can only be called after the player has rolled the dice.
	 */
	detEllerDerover: () => void;
	/**
	 * @description
	 * Ends the turn by revealing the previous action and penalizes the player who lied.
	 * If the previous player did not lie, the current player will be penalized.
	 * Revealing a true "Meyer" score will cause double penalty to the revealing player. Revealing a false "Meyer" score will cause double penalty to the liar (Previous player).
	 * Can only be called once per turn and only if the player is not the first in the round. Can only be called after the player has rolled the dice.
	 */
	reveal: () => void;
	/**
	 * @returns The score of the dice
	 * @description
	 * Rolls the dice and returns the score of the dice. Can only be called once per turn.
	 */
	roll: () => number;
	/**
	 * @description
	 * Ends the turn by announcing a score and passing the turn to the next player.
	 * The lie value must be equal to or higher than the previously announced value. Lying about "Meyer" score will cause double penalty if caught.
	 * Can only be called once per turn. Can only be called after the player has rolled the dice.
	 */
	lie: (value: number) => void;
}`

export default meyerFiles

export const dumbStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// Randomly reveal
	if (Math.random() > 0.5) {
		api.reveal()
		return
	}

	// Get previous announced value
	const lastScore = api.getPreviousAction()

	// Roll the dice
	const currentScore = api.roll()

	// If our score is higher or equal, finish the turn
	if (lastScore === null || currentScore >= lastScore) {
		return
	}

	// If our score is lower, we can either lie or call "det eller derover"
	if (Math.random() > 0.5) {
		api.lie(lastScore)
	} else {
		api.detEllerDerover()
	}
}

export default main`

export const honestStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// Get previous announced value
	const lastScore = api.getPreviousAction()

	// Roll the dice
	const currentScore = api.roll()

	// If our score is higher or equal, finish the turn
	if (lastScore === null || currentScore >= lastScore) {
		return
	}

	// If our score is lower, we call "det eller derover"
	api.detEllerDerover()
}

export default main`

export const lyingStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// We always lie with maximum score
	api.roll()
	api.lie(1000)
}

export default main`

export const statisticsStrategy = `const main = (api: MeyerStrategyAPI) => {
	// We'll try revealing or deciding on action before rolling if we want to accuse.
	// According to the error, we cannot reveal after rolling, so let's reveal first if needed.

	if (api.isFirstInRound()) {
		// If first in round, we must roll and that's all.
		api.roll()
		return
	}

	const lastScore = api.getPreviousAction()
	if (lastScore !== null) {
		// Compute probability distribution
		const allOutcomes: [number, number][] = []
		for (let d1 = 1; d1 <= 6; d1++) {
			for (let d2 = 1; d2 <= 6; d2++) {
				allOutcomes.push([d1, d2])
			}
		}

		const scores = allOutcomes.map(o => api.calculateDieScore(o))
		const total = scores.length
		// Count occurrences of each score
		const frequency: Record<number, number> = {}
		for (const s of scores) {
			frequency[s] = (frequency[s] ?? 0) + 1
		}
		// Sort scores ascending
		const uniqueScores = Object.keys(frequency).map(Number).sort((a, b) => a - b)

		// Probability of >= score: for each score, count outcomes >= that score
		// We'll create a helper function that given a score returns probability of rolling >= that score
		const probabilityAtLeast = (x: number) => {
			const validX = api.roundUpToValidScore(x)
			let count = 0
			for (const s of uniqueScores) {
				if (s >= validX) count += frequency[s]
			}
			return count / total
		}

		// If last score is extremely unlikely, reveal before rolling
		if (probabilityAtLeast(lastScore) < 0.2) {
			api.reveal()
			return
		}
	}

	// If we didn't reveal, now we roll
	const currentScore = api.roll()

	// If no last score or current >= last, do nothing
	if (lastScore === null || currentScore >= lastScore) return
	// We need to beat lastScore. Try to find a suitable lie:
	// Strategy:
	// 1. If gap small (<50), lying exactly at lastScore might be safe.
	// 2. Otherwise, try to find a score slightly higher than lastScore with decent probability.
	// 3. If no good plausible lie, fallback to detEllerDerover.

	const gap = lastScore - currentScore

	// If gap small, lie exactly at lastScore
	if (gap <= 50) {
		api.lie(lastScore)
		return
	}

	// Otherwise, det eller derover
	api.detEllerDerover()
}

export default main
`

export const detEllerDeroverStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// We always call 'det eller derover'
	api.roll()
	api.detEllerDerover()
}

export default main
`

export const revealingStrategy = `const main = (api: MeyerStrategyAPI) => {
	// If we're first in the round, we need to roll
	if (api.isFirstInRound()) {
		api.roll()
		return
	}

	// We always reveal last turn
	api.reveal()
}

export default main
`