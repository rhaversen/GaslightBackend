// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'

// Own modules
import { ISubmission } from './Submission.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Interfaces
export interface IGrading extends Document {
    // Properties
	/** Submission being graded */
    submission: string | ISubmission
	/** Score given to the submission */
    score: number
	/** Percentile rank of the submission */
	percentileRank: number
	/** Placement */
	placement: number
	/** TokenCount at the time of grading */
	tokenCount: number
	/** Average execution time */
	avgExecutionTime: number

    // Timestamps
    createdAt: Date
    updatedAt: Date
}

export interface IGradingPopulated extends IGrading {
	submission: ISubmission
}

// Schema
const gradingSchema = new Schema<IGrading>({
	submission: {
		type: Schema.Types.ObjectId,
		ref: 'Submission',
		required: true
	},
	score: {
		type: Schema.Types.Number,
		required: true
	},
	percentileRank: {
		type: Schema.Types.Number,
		required: true
	},
	placement: {
		type: Schema.Types.Number,
		required: true
	},
	avgExecutionTime: {
		type: Schema.Types.Number,
		required: true
	},
	tokenCount: {
		type: Schema.Types.Number,
		required: true
	}
}, {
	timestamps: true
})

// Validations

// Adding indexes
gradingSchema.index({ submission: 1 })

// Pre-save middleware
gradingSchema.pre('save', async function (next) {
	next()
})

// Pre-delete middleware
gradingSchema.pre(['deleteOne', 'findOneAndDelete'], async function (next) {
	next()
})

// Pre-delete-many middleware
gradingSchema.pre('deleteMany', async function (next) {
	next()
})

// Compile the schema into a model
const GradingModel = model<IGrading>('Grading', gradingSchema)

// Export the model
export default GradingModel
