// Node.js built-in modules

// Third-party libraries

// Own modules
import { ITournament } from '../models/Tournament.js'
import { emitSocketEvent } from '../utils/socket.js'

// Environment variables

// Config variables

// Destructuring and global variables

export function emitTournamentCreated(Tournament: ITournament): void {
	emitSocketEvent<ITournament>(
		'TournamentCreated',
		Tournament,
	)
}
