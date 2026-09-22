
import { MeyerStrategyAPI } from '../meyer/types.ts'

// Do nonsense work forever
let x = 0
while (true) {
	x++
	x % 100
}

// Just a simple strategy that rolls if it's first in the round, otherwise it calls "det eller derover"
const main = (api: MeyerStrategyAPI) => {
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

export default main
