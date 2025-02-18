// Node.js built-in modules

// Third-party libraries
import { compare, hash } from 'bcrypt'
import { type Document, model, Schema } from 'mongoose'
import { nanoid } from 'nanoid'

// Own modules
import config from '../utils/setupConfig.js'

// Environment variables

// Config variables

// Destructuring and global variables

const funnyAdjectives = [
	'Sleepy', 'Dancing', 'Quirky', 'Sparkly', 'Wobbly',
	'Bouncy', 'Jazzy', 'Wiggly', 'Fluffy', 'Cosmic',
	'Derpy', 'Snazzy', 'Clumsy', 'Grumpy', 'Glitchy',
	'Silly', 'Mystical', 'Sassy', 'Hungry', 'Zesty',
	'Magical', 'Dramatic', 'Awkward', 'Curious', 'Chaotic',
	'Groovy', 'Hyperactive', 'Peppy', 'Ridiculous', 'Enigmatic',
	'Chirpy', 'Bonkers', 'Fizzy', 'Spunky', 'Majestic'
]

const funnyNouns = [
	'Penguin', 'Unicorn', 'Ninja', 'Potato', 'Pickle',
	'Dinosaur', 'Wizard', 'Robot', 'Hamster', 'Developer',
	'Burrito', 'Pirate', 'Llama', 'Waffle', 'Dragon',
	'Raccoon', 'Noodle', 'Muffin', 'Kitten', 'Panda',
	'Banana', 'Zombie', 'Donut', 'Gamer', 'Taco',
	'Octopus', 'Marshmallow', 'Sandwich', 'Beaver', 'Lobster',
	'Chipmunk', 'Volcano', 'Airplane', 'Sprocket', 'Cactus'
]

const funnyPrefixes = [
	'Ultra', 'Mega', 'Professor', 'Count', 'Doctor',
	'Captain', 'Grand', 'Hyper', 'Papa', 'Admiral'
]

const funnyPostfixes = [
	'BG', 'XL', 'Jr', 'IV', 'III',
	'The Great', 'Prime', 'Universe', '3000', 'Supreme'
]

function generateFunnyUsername(): string {
	const usePrefix = Math.random() < 0.5
	const useAdjective = Math.random() < 0.5
	const usePostfix = Math.random() < 0.5

	const prefix = usePrefix ? funnyPrefixes[Math.floor(Math.random() * funnyPrefixes.length)] : ''
	const adjective = useAdjective ? funnyAdjectives[Math.floor(Math.random() * funnyAdjectives.length)] : ''
	const noun = funnyNouns[Math.floor(Math.random() * funnyNouns.length)]
	const postfix = usePostfix ? funnyPostfixes[Math.floor(Math.random() * funnyPostfixes.length)] : ''

	// Ensure at least one of prefix, adjective, or postfix is used
	if (!usePrefix && !useAdjective && !usePostfix) {
		const fallback = Math.floor(Math.random() * 3)
		if (fallback === 0) {
			return `${funnyPrefixes[Math.floor(Math.random() * funnyPrefixes.length)]} ${noun}`
		} else if (fallback === 1) {
			return `${funnyAdjectives[Math.floor(Math.random() * funnyAdjectives.length)]} ${noun}`
		} else {
			return `${noun} ${funnyPostfixes[Math.floor(Math.random() * funnyPostfixes.length)]}`
		}
	}

	return `${prefix} ${adjective} ${noun} ${postfix}`.trim().replace(/\s+/g, ' ')
}

// Config
const {
	bcryptSaltRounds,
	verificationExpiry,
	passwordResetExpiry
} = config

// Interfaces
export interface IUser extends Document {
	// Properties
	/** Username of the user */
	username: string
	/** Email of the user */
	email: string
	/** Hashed password of the user */
	password: string
	/** If the user has confirmed their email */
	confirmed: boolean

	/** Date when the user will be deleted if not confirmed */
	expirationDate?: Date
	/** Date when the password reset code will expire */
	passwordResetExpirationDate?: Date
	/** Code to confirm the user's email */
	confirmationCode?: string
	/** Code to reset the user's password */
	passwordResetCode?: string

	// Methods
	/** Compare the password with the hashed password */
	comparePassword: (password: string) => Promise<boolean>
	/** Confirm the user's email */
	confirmUser: () => void
	/** Reset the user's password */
	resetPassword: (newPassword: string, passwordResetCode: string) => Promise<void>
	/** Generate a new confirmation code */
	generateNewConfirmationCode: () => Promise<string>
	/** Generate a new password reset code */
	generateNewPasswordResetCode: () => Promise<string>

	// Timestamps
	createdAt: Date
	updatedAt: Date
}

const userSchema = new Schema<IUser>({
	username: {
		type: Schema.Types.String,
		trim: true,
		default: generateFunnyUsername,
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
}, {
	timestamps: true
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
		this.password = await hash(this.password, bcryptSaltRounds) // Using a random salt for each user
		this.passwordResetCode = undefined
	}
	next()
})

const UserModel = model<IUser>('User', userSchema)

export default UserModel
