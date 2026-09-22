export function rollDice (): [number, number] {
	const randomDie = () => Math.floor(Math.random() * 6) + 1
	return [randomDie(), randomDie()]
}

export function calculateScore (dice: [number, number]): number {
	const [die1, die2] = dice.sort((a, b) => b - a)
	if ((die1 === 2 && die2 === 1)) { return 1000 } // Meyer
	if ((die1 === 3 && die2 === 1)) { return 999 } // Lille-meyer
	if (die1 === die2) { return die1 * 100 } // Pairs
	return die1 * 10 + die2 // Regular scores
}

const validScores = new Set<number>([
	// Special scores
	1000, 999,
	// Pairs
	600, 500, 400, 300, 200, 100,
	// Regular scores
	65, 64, 63, 62, 61,
	54, 53, 52, 51,
	43, 42, 41,
	32
])

export function isValidScore (score: number): boolean {
	return validScores.has(score)
}

export function roundUpToValidScore (score: number): number {
	const validScoresAscending = [...validScores].sort((a, b) => a - b)
	for (const validScore of validScoresAscending) {
		if (score <= validScore) { return validScore }
	}
	return 0
}
