// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'

// Own modules
import { ISubmission } from './Submission.js'
import logger from '../utils/logger.js'

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
	/** Z-value */
	zValue: number

    // Timestamps
    createdAt: Date
    updatedAt: Date

    /** Calculate statistics for this specific grading */
    calculateStatistics(): Promise<IGradingStatistics>
}

export interface IGradingPopulated extends IGrading {
	submission: ISubmission
}

export interface IGradingStatistics {
    /** Percentile rank (0-100) of this grading's score */
    percentileRank: number
    /** Standard score (z-score) */
    standardScore: number
    /** How many standard deviations from mean */
    deviationsFromMean: number
    /** Relative performance (-1 to 1) compared to mean */
    normalizedScore: number
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
	zValue: {
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

// Add method to schema
gradingSchema.methods.calculateStatistics = async function(): Promise<IGradingStatistics> {
	const allGradings = await GradingModel.find({}).select('score').exec()
	const scores = allGradings.map(g => g.score)
    
	// Calculate mean and standard deviation
	const mean = scores.reduce((a, b) => a + b, 0) / scores.length
	const standardDeviation = Math.sqrt(
		scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length
	)
    
	// Calculate percentile rank
	const belowCount = scores.filter(score => score < this.score).length
	const percentileRank = (belowCount / scores.length) * 100
    
	// Calculate normalized score (-1 to 1 scale)
	const maxScore = Math.max(...scores)
	const minScore = Math.min(...scores)
	const normalizedScore = maxScore === minScore 
		? 0 
		: (2 * ((this.score - minScore) / (maxScore - minScore))) - 1
    
	return {
		percentileRank,
		standardScore: this.zValue,
		deviationsFromMean: standardDeviation === 0 ? 0 : (this.score - mean) / standardDeviation,
		normalizedScore
	}
}

// Compile the schema into a model
const GradingModel = model<IGrading>('Grading', gradingSchema)

// Export the model
export default GradingModel
