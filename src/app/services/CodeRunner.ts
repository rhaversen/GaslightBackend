// Node.js built-in modules

// Third-party libraries
import axios from 'axios'

// Own modules
import { ISubmission } from '../models/Submission.js'
import logger from '../utils/logger.js'
import AppConfig from '../utils/setupConfig.js'

// Environment variables

// Config variables
const {
	codeRunnerHost
} = AppConfig

// Destructuring and global variables

export async function submitCodeForTest(submission: ISubmission): Promise<boolean> {
	try {

		await axios.post(`http://${codeRunnerHost}/api/v1/grade-submission`, {
			submission
		})

		logger.info('Code submitted for test', submission.id)

		return true
	} catch (error) {
		if (error instanceof Error) {
			logger.error('Error submitting code for test', { error: error.message })
		} else {
			logger.error('Error submitting code for test', { error: String(error) })
		}

		return false
	}
}