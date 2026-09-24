import { Document, model, Schema } from 'mongoose'

export interface FileMap {
	'main.ts': string;
	[key: string]: string | undefined;
}

export interface IGame extends Document {
	// Game properties
	name: string
	description: string
	summary: string
	files: FileMap
	apiType: string
	exampleStrategy: string
	/** Smallest table the game can run with. Below this the game cannot start. */
	minPlayers: number
	/** Largest table the game supports. The runner seats min(maxPlayers, roster size). */
	maxPlayers: number
	/** User who submitted the game. Every game belongs to a user. */
	user: string
	// Timestamps
	createdAt: Date
	updatedAt: Date
}

const gameSchema = new Schema<IGame>({
	name: { type: String, required: true },
	description: { type: String, required: true, trim: true, maxlength: 5000 },
	summary: { type: String, required: true, trim: true, maxlength: 100 },
	files: {
		type: Object,
		required: true,
		validate: {
			validator: function (v: Record<string, string>) {
				return v && typeof v['main.ts'] === 'string'
			},
			message: 'files must have a main.ts file'
		}
	},
	apiType: { type: String, required: true },
	exampleStrategy: { type: String, required: true },
	minPlayers: { type: Number, required: true, min: 1 },
	maxPlayers: { type: Number, required: true, min: 1, max: 50 },
	user: {
		type: String,
		ref: 'User',
		required: true
	}
}, {
	timestamps: true
})

// Indexes — user → games they created (lens entry point), newest first
gameSchema.index({ user: 1, createdAt: -1 })

const GameModel = model<IGame>('Game', gameSchema)
export default GameModel
