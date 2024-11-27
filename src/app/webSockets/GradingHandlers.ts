// Node.js built-in modules

// Third-party libraries

// Own modules
import { IGrading } from '../models/Grading.js'
import { emitSocketEvent } from '../utils/socket.js'

// Environment variables

// Config variables

// Destructuring and global variables

export function emitGradingCreated(grading: IGrading): void {
	emitSocketEvent<IGrading>(
		'gradingCreated',
		grading,
	)
}

export function emitGradingUpdated(grading: IGrading): void {
	emitSocketEvent<IGrading>(
		'gradingUpdated',
		grading,
	)
}

export function emitGradingDeleted(grading: IGrading): void {
	emitSocketEvent<IGrading>(
		'gradingDeleted',
		grading,
	)
}