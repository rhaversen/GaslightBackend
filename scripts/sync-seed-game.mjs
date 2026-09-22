// Sync the canonical game source from the GaslightCodeRunner checkout into
// this repo's seed snapshot. The backend never reads the runner repo at
// runtime — this script refreshes the snapshot, and a drift test fails CI if
// the snapshot goes stale.
//
// Usage: node scripts/sync-seed-game.mjs [--check]
//   --check: exit 1 if the snapshot differs from canonical, without writing.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The canonical game source lives in the runner repo next to this one.
const canonicalRootCandidates = [
	resolve(backendRoot, '../GaslightCodeRunner/sourceFiles')
]

const canonicalRoot = canonicalRootCandidates.find(path => existsSync(path))
if (canonicalRoot === undefined) {
	console.error(
		'GaslightCodeRunner checkout not found. Expected one of:\n' +
		canonicalRootCandidates.map(p => `  ${p}`).join('\n') +
		'\nClone it as a sibling directory of GaslightBackend.'
	)
	process.exit(1)
}

const snapshotRoot = resolve(backendRoot, 'src/development/seedGameSource')

// What we sync: the meyer game and its demo strategies. GameRunner bundles,
// security attack fixtures, and commonTypes/errors are runner-internal and
// never seeded into the database.
const SYNC_DIRS = ['meyer', 'strategies']
const SKIP_SUBDIRS = new Set(['security'])

const check = process.argv.includes('--check')
const mismatches = []

function listFiles (dir) {
	const out = []
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) {
			if (SKIP_SUBDIRS.has(entry)) { continue }
			out.push(...listFiles(full).map(f => join(entry, f)))
		} else {
			out.push(entry)
		}
	}
	return out
}

function compareDir (relativeDir) {
	const from = join(canonicalRoot, relativeDir)
	const to = join(snapshotRoot, relativeDir)
	if (!existsSync(from)) {
		mismatches.push(`canonical missing: ${relativeDir}`)
		return
	}
	const files = listFiles(from)
	for (const file of files) {
		const fromFile = join(from, file)
		const toFile = join(to, file)
		if (!existsSync(toFile)) {
			mismatches.push(`snapshot missing: ${relativeDir}/${file}`)
			continue
		}
		if (readFileSync(fromFile, 'utf-8') !== readFileSync(toFile, 'utf-8')) {
			mismatches.push(`drifted: ${relativeDir}/${file}`)
		}
	}
}

function generateApiTypeDoc () {
	// The apiType column stores the strategy-facing API documentation shown to
	// players. It embeds the game's strategy-facing type surface verbatim, so
	// it can never drift from the API the runner actually enforces.
	const types = readFileSync(join(canonicalRoot, 'meyer', 'types.ts'), 'utf-8')
	const header = [
		'/**',
		' * Possible scores in Meyer:',
		' *',
		' * Special scores',
		' * 1000 (Meyer), 999 (Lille Meyer)',
		' *',
		' * All other scores follow the standard Meyer scoring table.',
		' */',
		''
	]
	return header.join('\n') + types
}

if (check) {
	if (!existsSync(snapshotRoot)) {
		console.error('Seed snapshot missing. Run: node scripts/sync-seed-game.mjs')
		process.exit(1)
	}
	for (const dir of SYNC_DIRS) {
		compareDir(dir)
	}
	const apiTypeFile = join(snapshotRoot, 'apiType.md')
	if (!existsSync(apiTypeFile)) {
		mismatches.push('snapshot missing: apiType.md')
	} else if (readFileSync(apiTypeFile, 'utf-8') !== generateApiTypeDoc()) {
		mismatches.push('drifted: apiType.md')
	}
	if (mismatches.length > 0) {
		console.error('Seed snapshot is out of date with GaslightCodeRunner/sourceFiles:\n' +
			mismatches.map(m => `  ${m}`).join('\n'))
		process.exit(1)
	}
	console.log('Seed snapshot is in sync with the canonical game source.')
	process.exit(0)
}

mkdirSync(snapshotRoot, { recursive: true })
for (const dir of SYNC_DIRS) {
	const target = join(snapshotRoot, dir)
	if (existsSync(target)) {
		rmSync(target, { recursive: true, force: true })
	}
	cpSync(join(canonicalRoot, dir), target, {
		recursive: true,
		filter: (src) => {
			// Keep runner-internal security fixtures out of the seed snapshot.
			const relative = src.slice(canonicalRoot.length + 1)
			const parts = relative.split(/[\\/]/)
			return !parts.some(part => SKIP_SUBDIRS.has(part))
		}
	})
}
writeFileSync(join(snapshotRoot, 'apiType.md'), generateApiTypeDoc())
console.log(`Seed snapshot updated from ${canonicalRoot}`)
