// Node.js built-in modules

// Third-party libraries
import axios from 'axios'

// Own modules
import SubmissionModel, { ISubmission } from '../models/Submission.js'
import logger from '../utils/logger.js'
import AppConfig from '../utils/setupConfig.js'
import { EvaluationResults } from '../types/CodeRunnerTypes.js'

// Environment variables
const {
	MICROSERVICE_AUTHORIZATION
} = process.env as Record<string, string>

// Config variables
const {
	codeRunnerHost
} = AppConfig

// Destructuring and global variables

export async function submitCodeForEvaluation(candidateSubmission: ISubmission): Promise<EvaluationResults | false> {
	try {
		const otherSubmissions = SubmissionModel.find({ _id: { $ne: candidateSubmission._id } })
		const response = await axios.post<EvaluationResults>(`http://${codeRunnerHost}/api/v1/evaluate-submission`, {
			candidateSubmission,
			otherSubmissions
		}, {
			headers: {
				Authorization: `Bearer ${MICROSERVICE_AUTHORIZATION}`
			}
		})

		return response.data
	} catch (error) {
		if (error instanceof Error) {
			logger.error('Error submitting code for test', { error: error.message })
		} else {
			logger.error('Error submitting code for test', { error: String(error) })
		}

		return false
	}
}
