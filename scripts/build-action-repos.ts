#!/usr/bin/env bun
/**
 * Assembles publish-ready trees for isreadyai/audit-action and isreadyai/fix-action
 * into dist-actions/<action>/, consumed by the sync-dedicated-actions release job.
 *
 *   bun run scripts/build-action-repos.ts [--only fix-action|audit-action]
 *
 * tree = actions/<action>/ template + node-target bundles + dist/package.json
 * {"type":"module"} + LICENSE (apps/cli/LICENSE).
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const MONO = resolve(import.meta.dir, '..')
const OUT_ROOT = resolve(MONO, 'dist-actions')
const NODE_SHEBANG = '#!/usr/bin/env node'

interface IBundle {
  entry: string
  out: string
}

interface IAction {
  name: string
  bundles: IBundle[]
}

const ACTIONS: IAction[] = [
  {
    name: 'audit-action',
    bundles: [
      { entry: 'apps/cli/src/index.ts', out: 'dist/scan.js' },
      { entry: 'apps/cli/src/from-json.ts', out: 'dist/summary.js' },
      { entry: 'apps/cli/src/ci-upload.ts', out: 'dist/ci-upload.js' },
    ],
  },
  {
    name: 'fix-action',
    bundles: [
      { entry: 'apps/cli/src/index.ts', out: 'dist/scan.js' },
      { entry: 'apps/cli/src/ci-upload.ts', out: 'dist/ci-upload.js' },
      { entry: 'fix-action/solve.ts', out: 'dist/solve.js' },
      { entry: 'fix-action/plan.ts', out: 'dist/plan.js' },
    ],
  },
]

const onlyFlag = process.argv.indexOf('--only')
const only = onlyFlag !== -1 ? process.argv[onlyFlag + 1] : undefined
const selected = only === undefined ? ACTIONS : ACTIONS.filter((a) => a.name === only)
if (only !== undefined && selected.length === 0) {
  console.error(
    `unknown action "${only}" — expected one of: ${ACTIONS.map((a) => a.name).join(', ')}`,
  )
  process.exit(1)
}

const bundleCache = new Map<string, string>()
async function buildBundle(entry: string): Promise<string> {
  const cached = bundleCache.get(entry)
  if (cached !== undefined) {
    return cached
  }
  const entryPath = resolve(MONO, entry)
  if (!existsSync(entryPath)) {
    console.error(`entrypoint not found: ${entry}`)
    process.exit(1)
  }
  const result = await Bun.build({ entrypoints: [entryPath], target: 'node', minify: false })
  if (!result.success) {
    for (const message of result.logs) {
      console.error(message)
    }
    process.exit(1)
  }
  const artifact = result.outputs.find((output) => output.kind === 'entry-point')
  if (artifact === undefined) {
    console.error(`no entry-point output for ${entry}`)
    process.exit(1)
  }
  const bundled = await artifact.text()
  let body = bundled.startsWith('#!') ? bundled.slice(bundled.indexOf('\n') + 1) : bundled

  // Bun's node build lowers solve.ts/plan.ts's `import.meta.main` to
  // `__require.main == __require.module` but never defines __require in ESM →
  // ReferenceError under node. Dist bundles only ever run directly, so force it true.
  const GUARD = '__require.main == __require.module'
  if (body.includes(GUARD)) {
    body = body.split(GUARD).join('true')
  }
  if (/\b__require\b/.test(body) && !/__require\s*=/.test(body)) {
    console.error(`ERROR: ${entry} still references an undefined __require after patching`)
    process.exit(1)
  }

  const withShebang = `${NODE_SHEBANG}\n${body}`
  bundleCache.set(entry, withShebang)
  return withShebang
}

const ESM_PKG = `${JSON.stringify({ type: 'module' }, null, 2)}\n`

for (const action of selected) {
  const templateDir = resolve(MONO, 'actions', action.name)
  if (!existsSync(templateDir)) {
    console.error(`missing template dir: actions/${action.name}`)
    process.exit(1)
  }
  const outDir = resolve(OUT_ROOT, action.name)
  rmSync(outDir, { recursive: true, force: true })
  cpSync(templateDir, outDir, { recursive: true })

  for (const bundle of action.bundles) {
    const code = await buildBundle(bundle.entry)
    const dest = resolve(outDir, bundle.out)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, code)
    const kb = Math.round((code.length / 1024) * 10) / 10
    console.log(`built ${action.name}/${bundle.out} (${kb} KB) from ${bundle.entry}`)
  }

  writeFileSync(resolve(outDir, 'dist/package.json'), ESM_PKG)
  cpSync(resolve(MONO, 'apps/cli/LICENSE'), resolve(outDir, 'LICENSE'))
  console.log(`assembled dist-actions/${action.name}`)
}
console.log('done')
