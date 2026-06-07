#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Single-source version sync
 *
 * The root package.json is the one place a version is set; every workspace
 * package inherits it. Run on release (and checked in CI) so the monorepo
 * ships one coherent version instead of drifting per-package numbers.
 */

const WORKSPACES = ['packages/scanner', 'packages/supabase', 'apps/cli', 'apps/web']

const root = JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }
const version = root.version
if (typeof version !== 'string' || version.length === 0) {
  console.error('root package.json has no "version"')
  process.exit(1)
}

const check = process.argv.includes('--check')
let drift = 0

for (const dir of WORKSPACES) {
  const path = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { name?: string; version?: string }
  if (pkg.version === version) {
    continue
  }
  if (check) {
    console.error(`${pkg.name ?? dir}: ${pkg.version ?? '(none)'} ≠ root ${version}`)
    drift += 1
    continue
  }
  pkg.version = version
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`${pkg.name ?? dir} → ${version}`)
}

if (check && drift > 0) {
  console.error(`\n${drift} package(s) out of sync — run "bun run version:sync"`)
  process.exit(1)
}
