/* eslint-disable local/enforce-comment-order */
// file deepcode ignore NoHardcodedPasswords/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore NoHardcodedCredentials/test: Hardcoded credentials are only used for testing purposes
// file deepcode ignore HardcodedNonCryptoSecret/test: Hardcoded credentials are only used for testing purposes

import UserModel from '../app/models/User.js'
import logger from '../app/utils/logger.js'

logger.info('Seeding database')

await UserModel.create({
	email: 'test@test.com',
	password: 'password',
})

logger.info('Database seeded')
