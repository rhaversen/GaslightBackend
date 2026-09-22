import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import assert from 'node:assert/strict'

// Drift tripwire: the seed snapshot in src/development/seedGameSource must
// always match the canonical game source in the GaslightCodeRunner repo. The
// snapshot exists because the two projects are separate repos and the backend
// must not read the runner checkout at runtime — but a stale snapshot would
// silently seed the database with an old game (this already happened once:
// the seed shipped a meyer without the api-ownership check). This test runs
// the sync script in check mode so divergence fails the suite instead.

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const syncScript = join(backendRoot, 'scripts', 'sync-seed-game.mjs')

describe('seed game source sync', () => {
	it('seed snapshot matches the canonical game source in GaslightCodeRunner', () => {
		assert.ok(
			existsSync(syncScript),
			'sync script missing from scripts/sync-seed-game.mjs'
		)

		let stdout: string
		try {
			stdout = execFileSync(process.execPath, [syncScript, '--check'], {
				cwd: backendRoot,
				encoding: 'utf-8',
				stdio: ['ignore', 'pipe', 'pipe']
			})
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error)
			assert.fail(
				'Seed snapshot is stale. Refresh it with: node scripts/sync-seed-game.mjs\n' +
				detail
			)
		}
		assert.ok(stdout.includes('in sync'), `unexpected sync output: ${stdout}`)
	})
})
