// Node.js built-in modules

// Third-party libraries
import axios from 'axios'

// Own modules
import { ISubmission, ISubmissionEvaluation } from '../models/Submission.js'
import logger from '../utils/logger.js'
import AppConfig from '../utils/setupConfig.js'
import { EvaluationResults } from '../types/CodeRunnerTypes.js'
import { IGame } from '../models/Game.js'

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
	gameFiles: FileMap;
	batchSize: number;
	gameId: string;
}

export interface ProcessedEvaluationResults {
	passedEvaluation: boolean;
	evaluation: ISubmissionEvaluation;
}

export async function submitCodeForEvaluation(candidateUser: string, candidateSubmission: ISubmission, game: IGame): Promise<ProcessedEvaluationResults | false> {
	try {
		const mappedCandidateSubmission: submission = {
			submissionId: candidateSubmission.id,
			files: { 'main.ts': candidateSubmission.code }
		}

		const response = await axios.post<EvaluationResults>(
			`${evaluationRunnerHost}/api/v1/evaluate-submission`,
			{
				gameFiles: game.files,
				gameId: game.id,
				batchSize: game.batchSize,
				candidateSubmission: mappedCandidateSubmission,
				candidateUser
			} as EvaluationRequestBody,
			{
				headers: {
					Authorization: `Bearer ${MICROSERVICE_AUTHORIZATION}`
				}
			}
		)

		const { results, disqualified, strategyLoadingTimings, strategyExecutionTimings, averageExecutionTime } = response.data

		let submissionPass = true
		let executionTimeExceeded = false
		let loadingTimeExceeded = false

		// Check if strategy loading time exceeded
		if (strategyLoadingTimings != undefined && strategyLoadingTimings > strategyLoadingTimeout) {
			submissionPass = false
			loadingTimeExceeded = true
		}

		if (averageExecutionTime != undefined && averageExecutionTime > strategyExecutionTimeout) {
			submissionPass = false
			executionTimeExceeded = true
		}

		// Check if disqualified
		if (disqualified != undefined) {
			submissionPass = false
		}

		// Check if results are valid
		if (response.data.results === undefined) {
			submissionPass = false
		}

		return {
			passedEvaluation: submissionPass,
			evaluation: {
				results,
				disqualified: disqualified ?? undefined,
				executionTimeExceeded,
				loadingTimeExceeded,
				strategyLoadingTimings: strategyLoadingTimings ?? undefined,
				strategyExecutionTimings: strategyExecutionTimings ?? undefined,
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
