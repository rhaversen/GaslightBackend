// Seed game source loader. Reads from src/development/seedGameSource/ — a
// synced snapshot of the canonical game code in GaslightCodeRunner/sourceFiles
// (see scripts/sync-seed-game.mjs). The snapshot is refreshed by that script
// and verified by src/test/seedGameSourceSync.unit.test.ts, so the database is
// always seeded with exactly the game the runner is tested against.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const seedSourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'seedGameSource')

function readSeedFile (...segments: string[]): string {
	return readFileSync(join(seedSourceRoot, ...segments), 'utf-8')
}

export function loadMeyerGameFiles (): Record<string, string> {
	return {
		'main.ts': readSeedFile('meyer', 'main.ts'),
		'gameState.ts': readSeedFile('meyer', 'gameState.ts'),
		'strategyAPI.ts': readSeedFile('meyer', 'strategyAPI.ts'),
		'types.ts': readSeedFile('meyer', 'types.ts'),
		'utils.ts': readSeedFile('meyer', 'utils.ts')
	}
}

export function loadApiTypeDoc (): string {
	return readSeedFile('apiType.md')
}

export function loadStrategy (name: string): string {
	return readSeedFile('strategies', `${name}.ts`)
}
