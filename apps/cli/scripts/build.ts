#!/usr/bin/env bun
import { rmSync } from 'node:fs'

// MARK: - CLI bundle for npm
//
// Bundles the CLI (scanner + clack inlined) into a single self-contained file
// so `npx isreadyai` runs on plain Node without installing the workspace. The
// entry keeps a bun shebang for local dev; the published bundle invokes node.

const NODE_SHEBANG = '#!/usr/bin/env node'
const OUT_FILE = 'dist/index.js'

rmSync('dist', { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ['src/index.ts'],
  outdir: 'dist',
  target: 'node',
})
if (!result.success) {
  for (const message of result.logs) {
    console.error(message)
  }
  process.exit(1)
}

const bundled = await Bun.file(OUT_FILE).text()
const body = bundled.startsWith('#!') ? bundled.slice(bundled.indexOf('\n') + 1) : bundled
await Bun.write(OUT_FILE, `${NODE_SHEBANG}\n${body}`)
console.log(`built ${OUT_FILE}`)
