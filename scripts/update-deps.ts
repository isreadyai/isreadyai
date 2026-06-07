import { execSync } from 'child_process'
import { readdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Collects the names of all workspace packages in the given base directories.
 *
 * @param {string[]} bases - An array of base directories to search for workspace packages.
 * @returns {string[]} - An array of workspace package names.
 */
function collectWorkspacePackageNames(bases: string[]): string[] {
  const names = new Set<string>()
  for (const base of bases) {
    if (!existsSync(base)) continue
    const entries = readdirSync(base, { withFileTypes: true }).filter((dirent) =>
      dirent.isDirectory(),
    )
    for (const entry of entries) {
      const pkgJsonPath = join(base, entry.name, 'package.json')
      if (!existsSync(pkgJsonPath)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
        if (typeof pkg.name === 'string' && pkg.name.length > 0) {
          names.add(pkg.name)
        }
      } catch {
        // ignore non-parsable package.json files
      }
    }
  }
  return [...names]
}

/**
 * Builds the command string for npm-check-updates (ncu) with the given reject list.
 *
 * @param {string[]} rejectList - An array of package names to reject from updates.
 * @returns {string} - The command string to run ncu with the specified reject list.
 */
function buildCommand(rejectList: string[]): string {
  // Run through bunx so the tool isn't a global-install dependency.
  const base = 'bunx npm-check-updates -t minor -u'
  if (rejectList.length === 0) return base
  // ncu takes a comma-separated list; quoted to handle scoped (@) package names.
  return `${base} --reject "${rejectList.join(',')}"`
}

/**
 * Runs a command in the specified directory, logging the output and handling errors.
 *
 * @param {string} dir - The directory in which to run the command.
 * @param {string} command - The command to run in the specified directory.
 * @returns {boolean} - true when the command succeeded, false when it failed.
 */
function runInDirectory(dir: string, command: string): boolean {
  console.log(`\n📂 Running in: ${dir}`)
  try {
    execSync(command, {
      cwd: dir,
      stdio: 'inherit',
      shell: true,
    })
    console.log(`✅ Completed: ${dir}`)
    return true
  } catch (error: unknown) {
    console.error(`❌ Error in ${dir}:`, error instanceof Error ? error.message : error)
    return false
  } finally {
    console.log('────────────────────────────────────')
  }
}

/** The main function to update dependencies. */
function main() {
  console.log('🚀 Starting dependency update with npm-check-updates...\n')

  const workspaceBases = ['apps', 'packages']
  const workspaceNames = collectWorkspacePackageNames(workspaceBases)
  if (workspaceNames.length > 0) {
    console.log(
      `🧩 Internal workspace packages excluded from ncu (${workspaceNames.length}): ${workspaceNames.join(', ')}\n`,
    )
  }
  const command = buildCommand(workspaceNames)
  const failures: string[] = []

  const patterns = [
    { base: 'apps', filter: () => true },
    { base: 'packages', filter: () => true },
    { base: 'packages/supabase/functions', filter: () => true },
  ]

  for (const { base, filter } of patterns) {
    if (!existsSync(base)) {
      console.log(`⚠️ Folder not found: ${base}`)
      continue
    }

    const entries = readdirSync(base, { withFileTypes: true }).filter(
      (dirent) => dirent.isDirectory() && filter(dirent.name),
    )

    for (const entry of entries) {
      const fullPath = join(base, entry.name)
      const packageJsonPath = join(fullPath, 'package.json')
      const denoJsonPath = join(fullPath, 'deno.json')

      if (existsSync(packageJsonPath) || existsSync(denoJsonPath)) {
        if (!runInDirectory(fullPath, command)) {
          failures.push(fullPath)
        }
      } else {
        console.log(`⚠️ Skipped (no package.json): ${fullPath}`)
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n❌ Update failed in ${failures.length} package(s): ${failures.join(', ')}`)
    process.exit(1)
  }
  console.log('\n🎉 Update completed!')
}

main()
