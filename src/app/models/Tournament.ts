// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema, SortOrder } from 'mongoose'

// Own modules
import GradingModel, { IGrading, IGradingPopulated, IGradingStatistics } from './Grading.js'
import SubmissionModel, { ISubmissionPopulated } from './Submission.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Interfaces
export interface TournamentStanding {
	user: string
	userName: string
	submission: string
	submissionName: string
	score: number
	zValue: number
	tokenCount: number
	placement: number
	statistics: IGradingStatistics
}

interface TournamentStatistics {
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

export interface ITournament extends Document {
	// Properties
	gradings: string[]
	disqualified?: [{
		submission: string
		reason: string
	}]
	tournamentExecutionTime: number

	// Methods
	/** Calculate the statistics of the tournament */
	calculateStatistics(): Promise<TournamentStatistics>
	/** Get the standings of the tournament in descending order */
	getStandings(limit?: number, skip?: number, sortField?: keyof IGrading, sortOrder?: SortOrder): Promise<TournamentStanding[]>
	/** Get the standing of a specific user */
	getStanding(userId: string): Promise<TournamentStanding | null>

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
	tournamentExecutionTime: {
		type: Schema.Types.Number,
		required: true
	}
}, {
	timestamps: true
})

tournamentSchema.methods.getStandings = async function (limit: number = 0, skip: number = 0, sortField: string = 'score', sortOrder: SortOrder = -1) {
	const gradings = await GradingModel.find({ _id: { $in: this.gradings } })
		.sort({ [sortField]: sortOrder })
		.skip(skip)
		.limit(limit || 0)
		.exec()

	const submissions = await SubmissionModel
		.find({ _id: { $in: gradings.map(g => g.submission) } })
		.populate('user', 'username')
		.exec() as ISubmissionPopulated[]

	const submissionMap = new Map(
		submissions.map(sub => [sub.id.toString(), sub])
	)

	const standings: TournamentStanding[] = []

	await Promise.all(gradings.map(async (grading) => {
		const submission = submissionMap.get(grading.submission.toString())
		if (!submission?.user) return

		standings.push({
			user: submission.user.id,
			userName: submission.user.username,
			submission: grading.submission.toString(),
			submissionName: submission.title,
			score: grading.score,
			zValue: grading.zValue,
			tokenCount: grading.tokenCount,
			placement: grading.placement,
			statistics: await grading.calculateStatistics()
		})
	}))

	return standings
}

tournamentSchema.methods.getStanding = async function (userId: string) {
	const grading = await GradingModel.findOne({
		_id: { $in: this.gradings },
		submission: {
			$in: await SubmissionModel
				.find({ user: userId })
				.select('_id')
				.exec()
		}
	}).exec()

	if (!grading) return null

	const submission = await SubmissionModel
		.findById(grading.submission)
		.populate('user', 'username')
		.exec() as ISubmissionPopulated

	if (!submission?.user) return null

	return {
		user: submission.user.id,
		userName: submission.user.username,
		submission: grading.submission.toString(),
		submissionName: submission.title,
		score: grading.score,
		zValue: grading.zValue,
		tokenCount: grading.tokenCount,
		placement: grading.placement,
		statistics: await grading.calculateStatistics()
	}
}

tournamentSchema.methods.calculateStatistics = async function () {
	const gradings = await GradingModel.find({ _id: { $in: this.gradings } }).exec()
	const scores = gradings.map(g => g.score).sort((a, b) => a - b)
	const sampleSize = scores.length

	if (sampleSize === 0) {
		throw new Error('Cannot calculate statistics with empty dataset')
	}

	// Central tendency measures
	const arithmeticMean = scores.reduce((a, b) => a + b, 0) / sampleSize

	// Harmonic mean (only for non-zero numbers)
	const harmonicMean = scores.every(score => score !== 0)
		? sampleSize / scores.reduce((a, b) => a + (1 / b), 0)
		: null

	// Mode calculation
	const mode = scores.reduce((acc, val) => {
		const count = scores.filter(v => v === val).length
		if (!acc.maxCount || count > acc.maxCount) {
			return { maxCount: count, values: [val] }
		}
		if (count === acc.maxCount && !acc.values.includes(val)) {
			acc.values.push(val)
		}
		return acc
	}, { maxCount: 0, values: [] as number[] }).values

	// Dispersion measures with Bessel's correction
	const variance = sampleSize > 1
		? scores.reduce((a, b) => a + Math.pow(b - arithmeticMean, 2), 0) / (sampleSize - 1)
		: 0
	const standardDeviation = Math.sqrt(variance)

	// Distribution shape
	const skewness = sampleSize > 2 && standardDeviation !== 0
		? (scores.reduce((a, b) => a + Math.pow((b - arithmeticMean) / standardDeviation, 3), 0) * sampleSize)
		/ ((sampleSize - 1) * (sampleSize - 2))
		: null

	const kurtosis = sampleSize > 3 && standardDeviation !== 0
		? ((scores.reduce((a, b) => a + Math.pow((b - arithmeticMean) / standardDeviation, 4), 0) * sampleSize * (sampleSize + 1))
			/ ((sampleSize - 1) * (sampleSize - 2) * (sampleSize - 3)))
		- (3 * Math.pow(sampleSize - 1, 2)) / ((sampleSize - 2) * (sampleSize - 3))
		: null

	// Percentile calculation using linear interpolation
	const getPercentile = (p: number) => {
		const rank = p * (sampleSize - 1)
		const floor = Math.floor(rank)
		const ceil = Math.ceil(rank)
		if (floor === ceil) return scores[floor]
		const fraction = rank - floor
		return scores[floor] * (1 - fraction) + scores[ceil] * fraction
	}

	const percentiles = {
		p10: getPercentile(0.10),
		p25: getPercentile(0.25),
		p50: getPercentile(0.50),
		p75: getPercentile(0.75),
		p90: getPercentile(0.90)
	}

	const interquartileRange = percentiles.p75 - percentiles.p25
	const tukeyCriteria = {
		lowerBound: percentiles.p25 - (1.5 * interquartileRange),
		upperBound: percentiles.p75 + (1.5 * interquartileRange)
	}

	const extrema = {
		minimum: scores[0], // array is already sorted
		maximum: scores[sampleSize - 1],
		range: scores[sampleSize - 1] - scores[0]
	}

	const outlierValues = scores.filter(score =>
		score < tukeyCriteria.lowerBound ||
		score > tukeyCriteria.upperBound
	)

	return {
		sampleSize,
		centralTendency: {
			arithmeticMean,
			harmonicMean,
			mode
		},
		dispersion: {
			variance,
			standardDeviation,
			interquartileRange
		},
		distribution: {
			skewness,
			kurtosis
		},
		percentiles,
		extrema,
		tukeyCriteria,
		outlierValues
	}
}

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

tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	// Check if all gradings are from different users
	const gradings = await GradingModel.find({ _id: { $in: v } }).populate('submission').exec() as IGradingPopulated[]
	const users = gradings.map(grading => grading.submission.user)
	const uniqueUsers = new Set(users)
	if (users.length !== uniqueUsers.size) {
		return false
	}
	return true
}, 'All gradings must be from different users')

tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	// Check if all gradings are from active and passed evaluation submissions
	const gradings = await GradingModel.find({ _id: { $in: v } }).populate({
		path: 'submission',
		populate: { path: 'user' }
	}).exec() as IGradingPopulated[]
	const submissions = gradings.map(grading => grading.submission) as ISubmissionPopulated[]
	const isValidSubmission = (submission: ISubmissionPopulated) => submission.active && submission.passedEvaluation
	if (submissions.some(submission => !isValidSubmission(submission))) {
		return false
	}
	return true
}, 'All gradings must be from active and passed evaluation submissions')

tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	// Check if some grading is in the disqualified array
	const gradings = await GradingModel.find({ _id: { $in: v } }).exec()
	const disqualifiedSubmissions = this.disqualified?.map(disqualification => disqualification.submission.toString()) || []
	if (gradings.some(grading => disqualifiedSubmissions.includes(grading.submission.toString()))) {
		return false
	}
	return true
}, 'All gradings must not be disqualified')

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

// Submissions users must be unique
tournamentSchema.path('gradings').validate(async function (v: Schema.Types.ObjectId[]) {
	const gradings = await GradingModel.find({ _id: { $in: v } }).populate('submission').exec() as IGradingPopulated[]
	const users = gradings.map(grading => grading.submission.user)
	const uniqueUsers = new Set(users)
	if (users.length !== uniqueUsers.size) {
		return false
	}
	return true
}, 'All submissions must be from different users')

// Adding indexes
tournamentSchema.index({ gradings: 1 })

// Pre-save middleware
tournamentSchema.pre('save', async function (next) {
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
