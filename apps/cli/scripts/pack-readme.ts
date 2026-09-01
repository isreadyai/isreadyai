#!/usr/bin/env bun
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * npm only renders a README that lives in the published package directory.
 * The product README lives at the monorepo root, so pack/publish copy it here
 * and rewrite repo-relative URLs to GitHub so images and file links resolve
 * on npmjs.com (the tarball does not include the rest of the repo).
 *
 * Cleanup must be `postpublish`, not `postpack`: npm publish re-reads the
 * manifest after packing and that pass is what the registry stores. Deleting
 * the staged README in postpack leaves the tarball correct but npmjs.com empty.
 */

const CLI_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(CLI_ROOT, '../..')
const DEST = join(CLI_ROOT, 'README.md')
const BRANCH = 'main'
const BLOB = `https://github.com/isreadyai/isreadyai/blob/${BRANCH}`
const RAW = `https://raw.githubusercontent.com/isreadyai/isreadyai/${BRANCH}`

export function rewriteRepoRelativeUrls(markdown: string): string {
  return markdown
    .replace(
      /src="(?!https?:|\/\/|#)([^"]+)"/g,
      (_match, path: string) => `src="${RAW}/${path.replace(/^\.\//, '')}"`,
    )
    .replace(
      /href="(?!https?:|\/\/|#|mailto:)([^"]+)"/g,
      (_match, path: string) => `href="${BLOB}/${path.replace(/^\.\//, '')}"`,
    )
    .replace(
      /\]\((?!\s*https?:\/\/|\s*\/\/|\s*#|\s*mailto:)(?:\.\/)?([^)]+)\)/g,
      (_match, path: string) => `](${BLOB}/${path})`,
    )
}

export function stageReadme(): void {
  const src = join(REPO_ROOT, 'README.md')
  if (!existsSync(src)) {
    throw new Error(`missing repo README at ${src}`)
  }
  writeFileSync(DEST, rewriteRepoRelativeUrls(readFileSync(src, 'utf8')))
}

export function cleanReadme(): void {
  if (existsSync(DEST)) {
    unlinkSync(DEST)
  }
}

if (import.meta.main) {
  if (process.argv.includes('--clean')) {
    cleanReadme()
  } else {
    stageReadme()
  }
}
