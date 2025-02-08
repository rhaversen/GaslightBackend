// Node.js built-in modules

// Third-party libraries
import { Document, model, Schema } from 'mongoose'

// Own modules

// Environment variables

// Config variables

// Destructuring and global variables
export interface FileMap {
	'main.ts': string;
	[key: string]: string;
}

export interface IGame extends Document {
	// Game properties
	name: string
	description?: string
	files: FileMap
	batchSize: number
	// Timestamps
	createdAt: Date
	updatedAt: Date
}

const gameSchema = new Schema<IGame>({
	name: { type: String, required: true },
	description: { type: String },
	files: {
		type: Object,
		required: true,
		validate: {
			validator: function (v: Record<string, string>) {
				return v && typeof v['main.ts'] === 'string'
			},
			message: 'files must contain a \'main.ts\' property'
		}
	},
	batchSize: { type: Number, required: true }
}, {
	timestamps: true
})

const GameModel = model<IGame>('Game', gameSchema)
export default GameModel
