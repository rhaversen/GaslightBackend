// Node.js built-in modules

// Third-party libraries
import { compare, hash } from 'bcrypt'
import { nanoid } from 'nanoid'
import { type Document, model, Schema } from 'mongoose'

// Own modules
import logger from '../utils/logger.js'
import config from '../utils/setupConfig.js'

// Environment variables

// Config variables

// Destructuring and global variables

// Config
const {
	bcryptSaltRounds,
	verificationExpiry,
	passwordResetExpiry
} = config

// Interfaces
export interface IUser extends Document {
	// Properties
	_id: Schema.Types.ObjectId
	username: string // Username of the user
	email: string // Email of the user
	password: string // Hashed password of the user
	confirmed: boolean // If the user has confirmed their email

	expirationDate?: Date // Date when the user will be deleted if not confirmed
	passwordResetExpirationDate?: Date // Date when the password reset code will expire
	confirmationCode?: string // Code to confirm the user's email
	passwordResetCode?: string // Code to reset the user's password

	// Methods
	comparePassword: (password: string) => Promise<boolean>
	confirmUser: () => void
	resetPassword: (newPassword: string, passwordResetCode: string) => Promise<void>
	generateNewConfirmationCode: () => Promise<string>
	generateNewPasswordResetCode: () => Promise<string>

	// Timestamps
	createdAt: Date
	updatedAt: Date
}

const userSchema = new Schema<IUser>({
	username: {
		type: Schema.Types.String,
		required: true,
		trim: true,
		maxlength: [50, 'Username must be at most 50 characters long']
	},
	email: {
		type: Schema.Types.String,
		required: true,
		unique: true,
		lowercase: true,
		trim: true,
		maxlength: [50, 'Email must be at most 50 characters long']
	},
	password: {
		type: Schema.Types.String,
		required: true,
		trim: true,
		minlength: [4, 'Password must be at least 4 characters long'],
		maxlength: [100, 'Password can be at most 100 characters long']
	},
	confirmed: {
		type: Schema.Types.Boolean,
		default: false
	},
	confirmationCode: {
		type: Schema.Types.String
	},
	expirationDate: {
		type: Schema.Types.Date
	},
	passwordResetCode: {
		type: Schema.Types.String
	},
	passwordResetExpirationDate: {
		type: Schema.Types.Date
	}
})

userSchema.index({ expirationDate: 1 }, { expireAfterSeconds: 0 })

userSchema.methods.confirmUser = function () {
	this.confirmed = true // Update the user's status to confirmed
	this.expirationDate = undefined // Unset the expiration date to cancel auto-deletion
	this.confirmationCode = undefined // Unset the confirmation code
}

type CodeFields = 'confirmationCode' | 'passwordResetCode'

async function generateUniqueCodeForField(field: CodeFields): Promise<string> {
	let generatedCode: string
	let existingUser: IUser | null

	do {
		generatedCode = nanoid()
		existingUser = await UserModel.findOne({ [ field ]: generatedCode })
	} while ((existingUser !== null))

	return generatedCode
}

userSchema.methods.generateNewConfirmationCode = async function (): Promise<string> {
	const newConfirmationCode = await generateUniqueCodeForField('confirmationCode')
	this.confirmationCode = newConfirmationCode
	this.expirationDate = new Date(Date.now() + verificationExpiry)
	return newConfirmationCode
}

userSchema.methods.generateNewPasswordResetCode = async function (): Promise<string> {
	const newPasswordResetCode = await generateUniqueCodeForField('passwordResetCode')
	this.passwordResetCode = newPasswordResetCode
	this.passwordResetExpirationDate = new Date(Date.now() + passwordResetExpiry)
	return newPasswordResetCode
}

userSchema.methods.resetPassword = async function (newPassword: string, passwordResetCode: string): Promise<void> {
	const hasPasswordResetCode = this.passwordResetCode !== undefined
	const isPasswordResetCodeValid = this.passwordResetCode === passwordResetCode
	const isPasswordResetCodeExpired = new Date() >= this.passwordResetExpirationDate
	if (hasPasswordResetCode && isPasswordResetCodeValid && !isPasswordResetCodeExpired) {
		this.password = await hash(newPassword, bcryptSaltRounds)
		this.passwordResetCode = undefined
		this.passwordResetExpirationDate = undefined
	}
}

userSchema.methods.comparePassword = async function (this: IUser, password: string): Promise<boolean> {
	const isPasswordCorrect = await compare(password, this.password)
	return isPasswordCorrect
}

userSchema.pre('save', async function (next) {
	if (this.isNew) {
		await this.generateNewConfirmationCode()
	}

	// Password hashing
	if (this.isModified('password')) {
		logger.silly('Password modified, hashing it')
		this.password = await hash(this.password, bcryptSaltRounds) // Using a random salt for each user
		this.passwordResetCode = undefined
	}
	next()
})

const UserModel = model<IUser>('User', userSchema)

export default UserModel
