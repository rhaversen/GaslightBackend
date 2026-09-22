import { MeyerStrategyAPI } from '../meyer/types.ts'

const main = (api: MeyerStrategyAPI) => {
	// Do nonsense work for 20 ms
	let i = 0
	const start = Date.now()
	while (Date.now() - start < 20) {
		i++
		i % 100
	}

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
