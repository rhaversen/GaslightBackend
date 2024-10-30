/* eslint-disable local/enforce-comment-order */

function randomDie(): number {
	return Math.floor(Math.random() * 6) + 1
}

export function rollDice(): [number, number] {
	return [randomDie(), randomDie()]
}

export function calculateScore(dice: [number, number]): number {
	const [die1, die2] = dice.sort((a, b) => b - a)
	if ((die1 === 2 && die2 === 1)) return 1000 // Meyer
	if ((die1 === 3 && die2 === 1)) return 999  // Lille-meyer
	if (die1 === die2) return die1 * 100        // Pairs
	return die1 * 10 + die2                     // Regular scores
}
