// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'
import * as esprima from 'esprima'

// Own modules
import GradingModel from './Grading.js'
import UserModel, { IUser } from './User.js'
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
	}
	/** Reason for disqualification */
	disqualified?: string
	/** If the execution time exceeded the limit */
	executionTimeExceeded: boolean
	/** If the loading time exceeded the limit */
	loadingTimeExceeded: boolean
	/** Time taken to load the strategy */
	strategyLoadingTimings?: number
	/** Time taken to execute the strategy */
	strategyExecutionTimings?: number[]
	/** Average execution time of the strategy */
	averageExecutionTime?: number
}

export interface ISubmission extends Document {
    // Properties
	/** Title of the submission */
    title: string
    /** Code submitted by the user */
	code: string
	/** User who submitted the code */
    user: Schema.Types.ObjectId | string | IUser
	/** Foreign key referencing game */
	game: Schema.Types.ObjectId | string
	/** Decides if the submission is part of the tournament (Can only have one active submission per user) */
    active: boolean
	/** Decides if the submission has passed an evaluation and is ready for tournaments. Null if not evaluated yet */
	passedEvaluation: boolean | null
	/** Evaluation results */
	evaluation: ISubmissionEvaluation

	// Methods
	/** Get the number of tokens in the submission code */
	getTokenCount: () => number

    // Timestamps
    createdAt: Date
    updatedAt: Date
}

export interface ISubmissionPopulated extends ISubmission {
	user: IUser
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
		type: Schema.Types.String
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
		type: Schema.Types.Number
	},
	strategyExecutionTimings: {
		type: [Schema.Types.Number]
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
	game: {
		type: Schema.Types.ObjectId,
		ref: 'Game',
		required: true
	},
	active: {
		type: Schema.Types.Boolean,
		default: false
	},
	passedEvaluation: {
		type: Schema.Types.Boolean,
		default: null
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
	const foundSubmission = await SubmissionModel.findOne({ user: this.user, game: this.game, active: true })
	return foundSubmission === null
}, 'User already has an active submission for this game')

submissionSchema.path('user').validate(async function (v: Schema.Types.ObjectId) {
	const foundUser = await UserModel.findById(v)
	return foundUser !== null
}, 'User does not exist')

// Adding indexes
submissionSchema.index({ user: 1 })
submissionSchema.index({ active: 1 })

// Methods
submissionSchema.methods.getTokenCount = function () {
	try {
		const tokens = esprima.tokenize(this.code)
		// Filter out comments, whitespace, and punctuation
		return tokens.filter(token => 
			token.type !== 'Punctuator' && 
            token.type !== 'BlockComment' && 
            token.type !== 'LineComment'
		).length
	} catch (error) {
		logger.error('Error parsing code for token count:', error)
		// Fallback to simple line counting if parsing fails
		return this.code.split('\n').filter((line: string): boolean => {
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
}

// Pre-save middleware
submissionSchema.pre('save', async function (next) {
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
