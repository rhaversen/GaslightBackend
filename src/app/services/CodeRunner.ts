// Node.js built-in modules

// Third-party libraries
import axios from 'axios'

// Own modules
import SubmissionModel, { ISubmission, ISubmissionEvaluation } from '../models/Submission.js'
import logger from '../utils/logger.js'
import AppConfig from '../utils/setupConfig.js'
import { EvaluationResults } from '../types/CodeRunnerTypes.js'

// Environment variables
const {
	MICROSERVICE_AUTHORIZATION
} = process.env as Record<string, string>

// Config variables
const {
	codeRunnerHost,
	strategyExecutionTimeout,
	strategyLoadingTimeout
} = AppConfig

// Destructuring and global variables

export interface FileMap {
	'main.ts': string;
	[key: string]: string;
}

interface submission {
	submissionId: string
	files: FileMap
}

interface EvaluationRequestBody {
	candidateSubmission: submission;
	otherSubmissions: submission[];
}

export interface ProcessedEvaluationResults {
  passedEvaluation: boolean;
  evaluation: ISubmissionEvaluation;
}

export async function submitCodeForEvaluation(candidateSubmission: ISubmission): Promise<ProcessedEvaluationResults | false> {
	try {
		let otherSubmissions
		otherSubmissions = await SubmissionModel.find({ _id: { $ne: candidateSubmission._id }, active: true, passedEvaluation: true })

		// If the candidate is the only submission, evaluate it against itself
		if (otherSubmissions.length === 0) {
			otherSubmissions = [{ id: 'other', code: candidateSubmission.code }]
		}

		const mappedCandidateSubmission: submission = {
			submissionId: candidateSubmission.id,
			files: { 'main.ts': candidateSubmission.code }
		}

		const mappedOtherSubmissions: submission[] = otherSubmissions.map(sub => ({
			submissionId: sub.id,
			files: { 'main.ts': sub.code }
		}))

		const response = await axios.post<EvaluationResults>(
			`${codeRunnerHost}/api/v1/evaluate-submission`,
			{
				candidateSubmission: mappedCandidateSubmission,
				otherSubmissions: mappedOtherSubmissions
			} as EvaluationRequestBody,
			{
				headers: {
					Authorization: `Bearer ${MICROSERVICE_AUTHORIZATION}`
				}
			}
		)

		let submissionPass = true
		let executionTimeExceeded = false
		let loadingTimeExceeded = false

		// Check if strategy loading time exceeded
		if (response.data.strategyLoadingTimings !== null && response.data.strategyLoadingTimings > strategyLoadingTimeout) {
			submissionPass = false
			loadingTimeExceeded = true
		}

		// Check if average strategy execution time exceeded
		const executionTimings = response.data.strategyExecutionTimings
		const averageExecutionTime = executionTimings ? executionTimings.reduce((a, b) => a + b, 0) / executionTimings.length : null

		if (executionTimings && averageExecutionTime !== null && averageExecutionTime > strategyExecutionTimeout) {
			submissionPass = false
			executionTimeExceeded = true
		}

		// Check if disqualified
		if (response.data.disqualified !== null) {
			submissionPass = false
		}

		// Check if results are valid
		if (response.data.results === undefined) {
			submissionPass = false
		}

		return {
			passedEvaluation: submissionPass,
			evaluation: {
				results: {
					candidate: response.data.results?.candidate ?? 0,
					average: response.data.results?.average ?? 0
				},
				disqualified: response.data.disqualified,
				executionTimeExceeded,
				loadingTimeExceeded,
				strategyLoadingTimings: response.data.strategyLoadingTimings ?? undefined,
				strategyExecutionTimings: response.data.strategyExecutionTimings ?? undefined,
				averageExecutionTime: averageExecutionTime ?? undefined
			}
		}
	} catch (error: any) {
		logger.error(
			'Error submitting code for test',
			error?.response?.data?.error ?? error.message,
		)
		return false
	}
}
