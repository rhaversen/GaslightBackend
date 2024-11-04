// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'

// Own modules
import logger from '../utils/logger.js'
import GradingModel from './Grading.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Interfaces
export interface ITournament extends Document {
    // Properties
    gradings: Schema.Types.ObjectId[] // All gradings created from this tournament

    // Timestamps
    createdAt: Date
    updatedAt: Date
}

// Schema
const tournamentSchema = new Schema<ITournament>({
	gradings: [{
		type: Schema.Types.ObjectId,
		ref: 'Grading',
		required: true
	}]
}, {
	timestamps: true
})

// Validations
tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	if (v.length === 0) {
		return false
	}
	return true
}, 'Tournament must have at least one grading')

tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	// Check if all gradings exist
	const gradings = await GradingModel.find({ _id: { $in: v } })
	if (gradings.length !== v.length) {
		return false
	}
	return true
}, 'All gradings must exist')

tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	// Check if all gradings are from different submissions
	const gradings = await GradingModel.find({ _id: { $in: v } })
	const submissions = gradings.map(grading => grading.submission)
	const uniqueSubmissions = new Set(submissions)
	if (submissions.length !== uniqueSubmissions.size) {
		return false
	}
	return true
}, 'All gradings must be from different submissions')

tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	// Check if length of unique gradings is the same as the length of the gradings
	const uniqueGradings = new Set(v)
	if (v.length !== uniqueGradings.size) {
		return false
	}
	return true
}, 'Gradings must be unique')

// Adding indexes
tournamentSchema.index({ gradings: 1 })

// Pre-save middleware
tournamentSchema.pre('save', async function (next) {
	logger.silly('Saving tournament')
	next()
})

// Pre-delete middleware
tournamentSchema.pre(['deleteOne', 'findOneAndDelete'], async function (next) {
	next()
})

// Pre-delete-many middleware
tournamentSchema.pre('deleteMany', async function (next) {
	next()
})

// Compile the schema into a model
const TournamentModel = model<ITournament>('Tournament', tournamentSchema)

// Export the model
export default TournamentModel
