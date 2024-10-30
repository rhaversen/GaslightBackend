// types.ts

export type DiePair = [number, number];

export interface StrategyAPI {
  getPreviousActions(): (number | null)[];
  isFirstInRound(): boolean;
  detEllerDerover(): void; // Awaiting description
  afslør(): void;
  slå(): DiePair;
  lyv(diePair: DiePair): void;
}

export type StrategyFunction = (api: StrategyAPI) => void;
