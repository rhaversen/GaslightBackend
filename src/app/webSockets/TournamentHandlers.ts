import { ITournament } from '../models/Tournament.js'
import { emitSocketEvent } from '../utils/socket.js'

export function emitTournamentCreated (Tournament: ITournament): void {
	emitSocketEvent<ITournament>(
		'TournamentCreated',
		Tournament
	)
}
