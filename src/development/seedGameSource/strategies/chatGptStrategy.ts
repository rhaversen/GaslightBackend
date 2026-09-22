import { MeyerStrategyAPI } from '../meyer/types.ts'

const main = (api: MeyerStrategyAPI) => {
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
				if (s >= validX) { count += frequency[s] }
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
	if (lastScore === null || currentScore >= lastScore) { return }
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
