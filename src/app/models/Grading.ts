// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'

// Own modules
import logger from '../utils/logger.js'
import { ISubmission } from './Submission.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Interfaces
export interface IGrading extends Document {
    // Properties
    submission: Schema.Types.ObjectId | ISubmission // Submission being graded
    score: number // Score given to the submission

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
		type: Number,
		required: true,
		min: 0,
		max: 1000
	}
}, {
	timestamps: true
})

// Validations

// Adding indexes
gradingSchema.index({ submission: 1 })

// Pre-save middleware
gradingSchema.pre('save', async function (next) {
	logger.silly('Saving grading')
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
