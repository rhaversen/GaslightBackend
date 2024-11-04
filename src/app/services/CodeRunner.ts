// Node.js built-in modules

// Third-party libraries
import axios from 'axios'

// Own modules
import logger from '../utils/logger.js'
import { ISubmission } from '../models/Submission.js'
import AppConfig from '../utils/setupConfig.js'

// Environment variables

// Config variables
const { 
	codeRunnerHost
} = AppConfig

// Destructuring and global variables

export async function submitCodeForTest (submission: ISubmission): Promise<boolean> {
	try {
		const { code, _id: submissionId } = submission
    
		await axios.post(`http://${codeRunnerHost}/api/v1/submissions`, {
			submissionId,
			code
		})
    
		logger.info('Code submitted for test', submission.id )
    
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