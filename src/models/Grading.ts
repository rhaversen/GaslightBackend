import { type Document, model, Schema } from 'mongoose'

// The central event document of the system. One grading records one
// submission's result in one tournament — it is immutable once written and
// carries denormalized dimension ids (tournament, game, user, submission) so
// every lens can start from an indexed match on any dimension without
// traversing parents. Labels (username, game name) are NOT denormalized here;
// they are mutable and resolved at read time via lookups.

export interface IGrading extends Document {
	// Dimensions (indexed event keys)
	/** Tournament this grading belongs to */
	tournament: string
	/** Game the tournament was held for */
	game: string
	/** Owner of the graded submission */
	user: string
	/** The graded submission */
	submission: string

	// Event facts (immutable snapshot at grading time)
	/** Score given to the submission */
	score: number
	/** Placement within the tournament */
	placement: number
	/** Percentile rank within the tournament */
	percentileRank: number
	/** Token count of the submission at grading time */
	tokenCount: number
	/** Average execution time of the submission */
	avgExecutionTime: number

	// Timestamps
	createdAt: Date
	updatedAt: Date
}

// Schema
const gradingSchema = new Schema<IGrading>({
	tournament: {
		type: Schema.Types.String,
		ref: 'Tournament',
		required: true
	},
	game: {
		type: Schema.Types.String,
		ref: 'Game',
		required: true
	},
	user: {
		type: Schema.Types.String,
		ref: 'User',
		required: true
	},
	submission: {
		type: Schema.Types.String,
		ref: 'Submission',
		required: true
	},
	score: {
		type: Schema.Types.Number,
		required: true
	},
	placement: {
		type: Schema.Types.Number,
		required: true
	},
	percentileRank: {
		type: Schema.Types.Number,
		required: true
	},
	tokenCount: {
		type: Schema.Types.Number,
		required: true
	},
	avgExecutionTime: {
		type: Schema.Types.Number,
		required: true
	}
}, {
	timestamps: true
})

// Indexes — one per lens entry point. Every lens pipeline begins with an
// indexed match on one of these, then sorts by date.
// Tournament → standings, sorted by placement
gradingSchema.index({ tournament: 1, placement: 1 })
// User → their graded history across games, newest first
gradingSchema.index({ user: 1, createdAt: -1 })
// Strategy → its own score history, newest first
gradingSchema.index({ submission: 1, createdAt: -1 })
// Game → all events for leaderboards/timelines, newest first
gradingSchema.index({ game: 1, createdAt: -1 })

const GradingModel = model<IGrading>('Grading', gradingSchema)

export default GradingModel
