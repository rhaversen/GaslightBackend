/* eslint-disable local/enforce-comment-order */
export interface EvaluationResults {
	error?: string
	results?: {
		candidate: number // Candidate's average
		average: number // Total average of other players
	},
	disqualified: string | null // Error or null
	strategyExecutionTimings: number[] // Timings
	strategyLoadingTimings: number // Timings
}

export interface TournamentResults {
	error?: string
	results?: Record<string, number> // submissionId -> score
	disqualified: Record<string, string> // submissionId -> error
	strategyExecutionTimings: Record<string, number[]> // submissionId -> timings
	strategyLoadingTimings: Record<string, number> // submissionId -> timings
}