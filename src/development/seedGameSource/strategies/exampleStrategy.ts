import { MeyerStrategyAPI } from '../meyer/types.ts'

const main = (api: MeyerStrategyAPI) => {
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

export default main
