// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'

// Own modules
import GradingModel from './Grading.js'
import logger from '../utils/logger.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Interfaces
interface TournamentWinner {
    user: string
    submission: string
    grade: number
    zValue: number
}

interface TournamentStatistics {
    percentiles: {
		p10: number
        p25: number
        p50: number
        p75: number
        p90: number
    }
    averageScore: number
	minMax: {
		min: number
		max: number
	}
	iqr: number
	outlierBoundaries: {
		lower: number
		upper: number
	}
	outliers: number[]
}

export interface ITournament extends Document {
    // Properties
	/** All gradings created from this tournament */
    gradings: string[]
	/** All disqualifications from this tournament */
	disqualified?: [{
		submission: string
		reason: string
	}]
    /** Tournament winners */
    winners: {
        first: TournamentWinner
        second?: TournamentWinner
        third?: TournamentWinner
    }
    /** Tournament statistics */
    statistics: TournamentStatistics

	/** Tournament execution time in milliseconds */
	tournamentExecutionTime: number

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
	}],
	disqualified: [{
		submission: {
			type: Schema.Types.ObjectId,
			ref: 'Submission',
			required: true
		},
		reason: {
			type: Schema.Types.String,
			required: true
		},
	}],
	winners: {
		first: {
			user: {
				type: Schema.Types.ObjectId,
				ref: 'User',
				required: true
			},
			submission: {
				type: Schema.Types.ObjectId,
				ref: 'Submission',
				required: true
			},
			grade: {
				type: Schema.Types.Number,
				required: true
			},
			zValue: {
				type: Schema.Types.Number,
				required: true
			},
		},
		second: {
			user: {
				type: Schema.Types.ObjectId,
				ref: 'User',
				required: false
			},
			submission: {
				type: Schema.Types.ObjectId,
				ref: 'Submission',
				required: false
			},
			grade: {
				type: Schema.Types.Number,
				required: false
			},
			zValue: {
				type: Schema.Types.Number,
				required: false
			},
		},
		third: {
			user: {
				type: Schema.Types.ObjectId,
				ref: 'User',
				required: false
			},
			submission: {
				type: Schema.Types.ObjectId,
				ref: 'Submission',
				required: false
			},
			grade: {
				type: Schema.Types.Number,
				required: false
			},
			zValue: {
				type: Schema.Types.Number,
				required: false
			},
		}
	},
	statistics: {
		percentiles: {
			p10: {
				type: Schema.Types.Number,
				required: true
			},
			p25: {
				type: Schema.Types.Number,
				required: true
			},
			p50: {
				type: Schema.Types.Number,
				required: true
			},
			p75: {
				type: Schema.Types.Number,
				required: true
			},
			p90: {
				type: Schema.Types.Number,
				required: true
			}
		},
		averageScore: {
			type: Schema.Types.Number,
			required: true
		},
		minMax: {
			min: {
				type: Schema.Types.Number,
				required: true
			},
			max: {
				type: Schema.Types.Number,
				required: true
			}
		},
		iqr: {
			type: Schema.Types.Number,
			required: true
		},
		outlierBoundaries: {
			lower: {
				type: Schema.Types.Number,
				required: true
			},
			upper: {
				type: Schema.Types.Number,
				required: true
			}
		},
		outliers: [{
			type: Schema.Types.Number,
			required: true
		}]
	},
	tournamentExecutionTime: {
		type: Schema.Types.Number,
		required: true
	}
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

tournamentSchema.path('disqualified').validate(async function (v: { submission: Schema.Types.ObjectId, reason: string }[]) {
	// Check if all submissions exist
	const submissions = v.map(disqualification => disqualification.submission)
	if (submissions.length !== v.length) {
		return false
	}
	return true
}, 'All submissions must exist')

tournamentSchema.path('disqualified').validate(async function (v: { submission: Schema.Types.ObjectId, reason: string }[]) {
	// Check if all submissions are from different submissions
	const submissions = v.map(disqualification => disqualification.submission)
	const uniqueSubmissions = new Set(submissions)
	if (submissions.length !== uniqueSubmissions.size) {
		return false
	}
	return true
}, 'All submissions must be different')

tournamentSchema.path('disqualified').validate(async function (v: { submission: Schema.Types.ObjectId, reason: string }[]) {
	// Check if length of unique submissions is the same as the length of the submissions
	const uniqueSubmissions = new Set(v.map(disqualification => disqualification.submission))
	if (v.length !== uniqueSubmissions.size) {
		return false
	}
	return true
}, 'Submissions must be unique')

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
