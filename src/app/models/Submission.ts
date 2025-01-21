// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'

// Own modules
import GradingModel from './Grading.js'
import UserModel from './User.js'
import logger from '../utils/logger.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Interfaces
export interface ISubmissionEvaluation {
	// Properties
	results: {
		/** This submission's score */
		candidate: number
		/** Average score of all submissions */
		average: number
	} | undefined
	/** Reason for disqualification */
	disqualified: string | null
	/** If the execution time exceeded the limit */
	executionTimeExceeded: boolean
	/** If the loading time exceeded the limit */
	loadingTimeExceeded: boolean
	/** Time taken to load the strategy */
	strategyLoadingTimings: number
	/** Time taken to execute the strategy */
	strategyExecutionTimings: number[]
	/** Average execution time of the strategy */
	averageExecutionTime: number
}

export interface ISubmission extends Document {
    // Properties
	/** Title of the submission */
    title: string
    /** Code submitted by the user */
	code: string
	/** User who submitted the code */
    user: Schema.Types.ObjectId
	/** Decides if the submission is part of the tournament (Can only have one active submission per user) */
    active: boolean
	/** Decides if the submission has passed an evaluation and is ready for tournaments */
	passedEvaluation: boolean
	/** Evaluation results */
	evaluation: ISubmissionEvaluation

	// Methods
	/** Get the number of lines of code in the submission */
	getLoc: () => number

    // Timestamps
    createdAt: Date
    updatedAt: Date
}

const evaluationSubSchema = new Schema<ISubmissionEvaluation>({
	results: {
		candidate: {
			type: Schema.Types.Number
		},
		average: {
			type: Schema.Types.Number
		}
	},
	disqualified: {
		type: Schema.Types.Mixed
	},
	executionTimeExceeded: {
		type: Schema.Types.Boolean,
		required: true
	},
	loadingTimeExceeded: {
		type: Schema.Types.Boolean,
		required: true
	},
	strategyLoadingTimings: {
		type: Schema.Types.Mixed
	},
	strategyExecutionTimings: {
		type: Schema.Types.Mixed
	},
	averageExecutionTime: {
		type: Schema.Types.Number
	}
}, {
	timestamps: true
})

// Schema
const submissionSchema = new Schema<ISubmission>({
	title: {
		type: Schema.Types.String,
		required: true,
		maxlength: 100
	},
	code: {
		type: Schema.Types.String,
		required: true,
		maxlength: 10000
	},
	user: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	active: {
		type: Schema.Types.Boolean,
		default: false
	},
	passedEvaluation: {
		type: Schema.Types.Boolean,
		default: false
	},
	evaluation: evaluationSubSchema
}, {
	timestamps: true
})

// Validations
submissionSchema.path('active').validate(async function (v: boolean) {
	if (!v) {
		return true
	}
	const foundActiveSubmission = await SubmissionModel.findOne({
		user: this.user,
		active: true,
		_id: { $ne: this._id }
	})
	return foundActiveSubmission === null
}, 'User already has an active submission')

submissionSchema.path('user').validate(async function (v: Schema.Types.ObjectId) {
	const foundUser = await UserModel.findById(v)
	return foundUser !== null
}, 'User does not exist')

// Adding indexes
submissionSchema.index({ user: 1 })
submissionSchema.index({ active: 1 })

// Methods
submissionSchema.methods.getLoc = function () {
	// TODO: Count tokens instead of lines
	return (this as ISubmission).code.split('\n').filter((line: string): boolean => {
		const trimmed = line.trim()
		return trimmed !== '' 
			&& trimmed !== ' '
			&& trimmed !== '\t'
			&& !trimmed.startsWith('//')
			&& !trimmed.startsWith('/*')
			&& !trimmed.startsWith('*')
			&& !trimmed.startsWith('#')
			&& !trimmed.startsWith(';')
			&& !trimmed.startsWith('(*')
	}).length
}

// Pre-save middleware
submissionSchema.pre('save', async function (next) {
	logger.silly('Saving submission')
	next()
})

// Pre-delete middleware
submissionSchema.pre(['deleteOne', 'findOneAndDelete'], async function (next) {
	const doc = await SubmissionModel.findOne(this.getQuery())
	// Delete gradings
	if (doc !== null && doc !== undefined) {
		await GradingModel.deleteMany({ submission: doc._id })
	}
	next()
})

// Pre-delete-many middleware
submissionSchema.pre('deleteMany', async function (next) {
	const docs = await SubmissionModel.find(this.getQuery())
	const docIds = docs.map(doc => doc._id)
	// Delete gradings
	if (docIds.length > 0) {
		await GradingModel.deleteMany({ submission: { $in: docIds } })
	}
	next()
})

// Compile the schema into a model
const SubmissionModel = model<ISubmission>('Submission', submissionSchema)

// Export the model
export default SubmissionModel
