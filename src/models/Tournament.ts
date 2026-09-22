import { type Document, model, Schema } from 'mongoose'

export interface TournamentStanding {
	user: string
	userName: string
	submission: string
	submissionName: string
	score: number
	tokenCount: number
	placement: number
	percentileRank: number
	avgExecutionTime: number
}

export interface TournamentStatistics {
	sampleSize: number
	centralTendency: {
		/** Simple average of all scores */
		arithmeticMean: number
		/** Only calculated for non-zero scores. Useful for averaging rates */
		harmonicMean: number | null
		/** Most frequent score(s) */
		mode: number[]
	}
	dispersion: {
		/** Average squared deviation from the mean */
		variance: number
		/** Square root of variance, indicates spread of scores */
		standardDeviation: number
		/** Difference between 75th and 25th percentiles */
		interquartileRange: number
	}
	distribution: {
		/** Measure of asymmetry. Positive means tail on right, negative means tail on left */
		skewness: number | null
		/** Measure of outliers. Higher values mean more extreme outliers */
		kurtosis: number | null
	}
	percentiles: {
		p10: number
		p25: number
		p50: number
		p75: number
		p90: number
	}
	extrema: {
		minimum: number
		maximum: number
		range: number
	}
	tukeyCriteria: {
		lowerBound: number
		upperBound: number
	}
	outlierValues: number[]
}

// A tournament is the "when" of the event stream: one run of a game on one
// day. It holds no standings itself — gradings reference it — so the
// document stays a fixed size regardless of participation.

export interface ITournament extends Document {
	// Properties
	/** Foreign key referencing game for which the tournament is held */
	game: string
	/** Amount of gradings recorded for this tournament (kept in sync on write) */
	gradingCount: number
	/** Total wall-clock execution time of the tournament run */
	tournamentExecutionTime: number
	/** Submissions disqualified during the tournament, with reasons */
	disqualified: Array<{
		submission: string
		reason: string
	}>

	// Timestamps
	createdAt: Date
	updatedAt: Date
}

// Schema
const tournamentSchema = new Schema<ITournament>({
	game: {
		type: Schema.Types.String,
		ref: 'Game',
		required: true
	},
	gradingCount: {
		type: Schema.Types.Number,
		required: true,
		default: 0
	},
	tournamentExecutionTime: {
		type: Schema.Types.Number,
		required: true
	},
	disqualified: [{
		submission: {
			type: Schema.Types.String,
			ref: 'Submission',
			required: true
		},
		reason: {
			type: Schema.Types.String,
			required: true
		}
	}]
}, {
	timestamps: true
})

// Indexes — game → tournaments newest first (timeline lens)
tournamentSchema.index({ game: 1, createdAt: -1 })

const TournamentModel = model<ITournament>('Tournament', tournamentSchema)

export default TournamentModel
