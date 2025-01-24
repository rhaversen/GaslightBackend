// Node.js built-in modules

// Third-party libraries
import { type PassportStatic } from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'

// Own modules
import UserModel, { type IUser } from '../models/User.js'

// Environment variables

// Config variables

// Destructuring and global variables

declare global {
	namespace Express {
		interface User extends IUser { }
	}
}

const configurePassport = (passport: PassportStatic): void => {
	// Local User Strategy
	passport.use('user-local', new LocalStrategy({
		usernameField: 'email',
		passwordField: 'password'
	}, (email, password, done) => {
		(async () => {
			try {
				const user = await UserModel.findOne({ email }).exec()
				if (user === null || user === undefined) {
					done(null, false, { message: 'User with email ' + email + ' does not exist.' })
					return
				}

				const isMatch = await user.comparePassword(password)
				if (!isMatch) {
					done(null, false, { message: 'Invalid password' })
					return
				}

				done(null, user)
			} catch (err) {
				done(err)
			}
		})().catch(err => { done(err) })
	}))

	passport.serializeUser(function (user: IUser, done) {
		const userId = user.id
		done(null, userId)
	})

	passport.deserializeUser(function (id, done) {
		UserModel.findById(id).exec()
			.then(user => {
				if (user !== null && user !== undefined) {
					done(null, user) // Call done with the user object
				} else {
					done(new Error('User not found'), false) // Error handling for admin not found
				}
			})
			.catch(err => {
				done(err, false) // Error handling
			})
	})
}

export default configurePassport
