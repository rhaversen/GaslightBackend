// Node.js built-in modules

// Third-party libraries
import { Document, model, Schema } from 'mongoose'

// Own modules

// Environment variables

// Config variables

// Destructuring and global variables
export interface FileMap {
	'main.ts': string;
	[key: string]: string | undefined;
}

export interface IGame extends Document {
	// Game properties
	name: string
	description?: string
	files: FileMap
	apiTypes: string
	exampleStrategy: string
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
			message: 'files must have a main.ts file'
		}
	},
	apiTypes: { type: String, required: true },
	exampleStrategy: { type: String, required: true },
	batchSize: { type: Number, required: true }
}, {
	timestamps: true
})

const GameModel = model<IGame>('Game', gameSchema)
export default GameModel
