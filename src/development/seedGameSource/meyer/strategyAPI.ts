import { tagApi } from '../gameGuard.ts'

import { gameState } from './gameState.ts'
import { MeyerStrategyAPI, DiePair, PlayerError } from './types.ts'
import { calculateScore, isValidScore, rollDice, roundUpToValidScore } from './utils.ts'

export function createStrategyAPI (playerIndex: number, ownerSubmissionId: string): MeyerStrategyAPI {
	const ensureTurnActive = () => {
		if (!gameState.isTurnActive()) {
			throw new PlayerError('Your turn has ended. You can only perform one action to end your turn: either call "det eller derover" to match the previous strategy\'s announcement, reveal to challenge the previous player\'s announcement, or announce your own roll (by calling "lie" or returning after a roll).')
		}
	}

	const api = {
		calculateDieScore: (dice: DiePair) => {
			if (!dice || !Array.isArray(dice) || dice.length !== 2) {
				throw new PlayerError('Invalid dice pair provided. Must be an array of exactly two numbers.')
			}
			if (!dice.every(die => Number.isInteger(die) && die >= 1 && die <= 6)) {
				throw new PlayerError('Invalid dice pair provided. Each die must be an integer between 1 and 6.')
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
				throw new PlayerError('The score you are trying to round up is higher than the maximum possible score of 1000.')
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
				throw new PlayerError('You must roll the dice before calling "det eller derover". Rolling first lets you see your score before deciding to match the previous strategy\'s announcement.')
			}

			if (gameState.isFirstInRound()) {
				throw new PlayerError('As the first player in a round, you cannot call "det eller derover" as there is no previous announcement to match. You must roll and announce a value.')
			}

			const prevAction = gameState.getRoundActions()[0]
			if (!prevAction) {
				throw new PlayerError('Cannot call "det eller derover" - no previous announcement exists to match against.')
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
				throw new PlayerError('You can only reveal as your first action. Once you roll the dice, you must either announce a value (by calling "lie" or returning after a roll), or call "det eller derover" to match the previous strategy\'s announcement.')
			}

			const prevPlayerIndex = gameState.getPrevPlayerIndex()
			const prevAction = gameState.getRoundActions()[0]

			if (!prevAction) {
				throw new PlayerError('As the first player in a round, you cannot reveal as there is no previous announcement to challenge. First players in a round must roll and announce a value.')
			}

			const prevPlayerLied = prevAction.value < prevAction.announcedValue // Doing 'det eller derover' while not scoring that or higher is considered lying
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
				throw new PlayerError('You can only roll once per turn. After rolling, you must either announce a value (calling "lie" or returning after a roll) or call "det eller derover" to match the previous strategy\'s announcement.')
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
				throw new PlayerError('You must roll the dice before announcing a value. This lets you see your actual score before deciding what value to announce (by calling "lie" or returning after a roll).')
			}

			const lieValue = score
			const realValue = gameState.getTurnActions()[0].value
			const prevTurnValue = gameState.getRoundActions()[0]?.announcedValue || 0

			if (!isValidScore(lieValue)) {
				throw new PlayerError(`The announced value ${lieValue} is not valid. Valid scores can be found in the documentation. Use roundUpToValidScore() or calculateDieScore() to get valid scores.`)
			}

			if (lieValue < prevTurnValue) { // Must announce a higher value than the previous player
				throw new PlayerError(`You must announce a higher value than the previous player. They announced ${prevTurnValue}, but you tried to announce ${lieValue}. If you cannot or don't want to announce higher, consider using "det eller derover" or revealing.`)
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
	return tagApi(api, ownerSubmissionId)
}

