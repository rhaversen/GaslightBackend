/* eslint-disable local/enforce-comment-order */

export type DiePair = [number, number];
type ActionTypes = 'detEllerDerover' | 'roll';

export interface StrategyAPI {
	getPreviousActions(): Action[];
	isFirstInRound(): boolean;
	detEllerDerover(): void;
	reveal(): void;
	roll(): number;
	lie(diePair: DiePair): void;
}

export interface Action {
	type: ActionTypes
	value: number
	playerIndex: number
}

export type StrategyFunction = (api: StrategyAPI) => void;
