// Game source loader for the dev seed. Reads from the gaslight-games
// submodule mounted at src/development/games/ — the canonical home of the
// game content (see the submodule's README). The database is the only
// runtime source of game files; this loader exists solely so `npm run dev`
// can seed the in-memory database with the same game the runner's tests
// validate against.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const gamesRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'games')

function readSeedFile (...segments: string[]): string {
	return readFileSync(join(gamesRoot, ...segments), 'utf-8')
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

export function loadStrategy (name: string): string {
	return readSeedFile('strategies', `${name}.ts`)
}

export function loadApiTypeDoc (): string {
	return readSeedFile('strategies', 'apiType.md')
}
