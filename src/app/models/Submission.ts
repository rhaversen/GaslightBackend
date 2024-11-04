// Node.js built-in modules

// Third-party libraries
import { type Document, model, Schema } from 'mongoose'

// Own modules
import logger from '../utils/logger.js'
import GradingModel from './Grading.js'
import UserModel from './User.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Interfaces
export interface ISubmission extends Document {
    // Properties
    title: string // Title of the submission
    code: string // Code submitted by the user
    user: Schema.Types.ObjectId // User who submitted the code
    active: boolean // Decides if the submission is part of the tournament (Can only have one active submission per user)

    // Timestamps
    createdAt: Date
    updatedAt: Date
}

// Schema
const submissionSchema = new Schema<ISubmission>({
	title: {
		type: String,
		required: true,
		maxlength: 100
	},
	code: {
		type: String,
		required: true,
		maxlength: 10000
	},
	user: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	active: {
		type: Boolean,
		default: false
	}
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
