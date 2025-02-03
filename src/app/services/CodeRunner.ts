// Node.js built-in modules

// Third-party libraries
import axios from 'axios'

// Own modules
import { ISubmission, ISubmissionEvaluation } from '../models/Submission.js'
import logger from '../utils/logger.js'
import AppConfig from '../utils/setupConfig.js'
import { EvaluationResults } from '../types/CodeRunnerTypes.js'

// Environment variables
const {
	MICROSERVICE_AUTHORIZATION
} = process.env as Record<string, string>

// Config variables
const {
	evaluationRunnerHost,
	strategyExecutionTimeout,
	strategyLoadingTimeout
} = AppConfig

// Destructuring and global variables

export interface FileMap {
	'main.ts': string;
	[key: string]: string;
}

export interface submission {
	submissionId: string
	files: FileMap
}

interface EvaluationRequestBody {
	candidateSubmission: submission;
	excludeUser: string;
}

export interface ProcessedEvaluationResults {
	passedEvaluation: boolean;
	evaluation: ISubmissionEvaluation;
}

function calculatePercentile(numbers: number[], percentile: number): number {
	const sorted = [...numbers].sort((a, b) => a - b)
	const index = Math.ceil((percentile / 100) * sorted.length) - 1
	return sorted[index]
}

function filterByPercentile(timings: number[], percentile: number): number[] {
	if (!timings || timings.length === 0) return []
	const p95 = calculatePercentile(timings, percentile)
	return timings.filter(timing => timing <= p95)
}

function calculateAverage(numbers: number[]): number {
	if (!numbers || numbers.length === 0) return 0
	return numbers.reduce((sum, num) => sum + num, 0) / numbers.length
}

export async function submitCodeForEvaluation(candidateSubmission: ISubmission): Promise<ProcessedEvaluationResults | false> {
	try {
		const mappedCandidateSubmission: submission = {
			submissionId: candidateSubmission.id,
			files: { 'main.ts': candidateSubmission.code }
		}

		const response = await axios.post<EvaluationResults>(
			`${evaluationRunnerHost}/api/v1/evaluate-submission`,
			{
				candidateSubmission: mappedCandidateSubmission,
				excludeUser: candidateSubmission.user
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

		// Filter and check execution timings
		const executionTimings = response.data.strategyExecutionTimings
		const filteredTimings = executionTimings ? filterByPercentile(executionTimings, 95) : null
		const averageExecutionTime = filteredTimings?.length ? calculateAverage(filteredTimings) : null

		if (filteredTimings?.length && averageExecutionTime !== null && averageExecutionTime > strategyExecutionTimeout) {
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
				strategyExecutionTimings: executionTimings ?? undefined,
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
