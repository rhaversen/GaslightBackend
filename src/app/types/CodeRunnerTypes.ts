export interface EvaluationResults {
	error?: string
	results: {
		candidate: number // Candidate's average
		average: number // Total average of other players
	},
	disqualified: string | null // Error or null
	strategyLoadingTimings: number | null // Timings
	strategyExecutionTimings: number[] | null // Timings
	averageExecutionTime: number | null // Average execution time of candidate
}

export interface TournamentResults {
	error?: string
	results?: Record<string, number> // submissionId -> score
	disqualified: Record<string, string> // submissionId -> error
	strategyExecutionTimings: Record<string, number[]> // submissionId -> timings
	strategyLoadingTimings: Record<string, number> // submissionId -> timings
}
