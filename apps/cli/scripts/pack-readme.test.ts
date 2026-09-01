import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanReadme, rewriteRepoRelativeUrls, stageReadme } from './pack-readme.ts'

const CLI_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STAGED = join(CLI_ROOT, 'README.md')

describe('rewriteRepoRelativeUrls', () => {
  test('rewrites repo-relative images and file links, leaves remote and in-page refs', () => {
    const input = [
      '<img src="apps/web/app/icon.svg" alt="logo" />',
      '<a href="LICENSE">MIT</a>',
      'See [contributing](./CONTRIBUTING.md) and [about](#about-the-project).',
      'Live: [isready.ai](https://isready.ai)',
    ].join('\n')

    const out = rewriteRepoRelativeUrls(input)

    expect(out).toContain(
      'src="https://raw.githubusercontent.com/isreadyai/isreadyai/main/apps/web/app/icon.svg"',
    )
    expect(out).toContain('href="https://github.com/isreadyai/isreadyai/blob/main/LICENSE"')
    expect(out).toContain('](https://github.com/isreadyai/isreadyai/blob/main/CONTRIBUTING.md)')
    expect(out).toContain('](#about-the-project)')
    expect(out).toContain('](https://isready.ai)')
  })
})

describe('stageReadme', () => {
  afterEach(() => {
    cleanReadme()
  })

  test('copies the repo README into the CLI package root', () => {
    stageReadme()
    expect(existsSync(STAGED)).toBe(true)
    const body = readFileSync(STAGED, 'utf8')
    expect(body).toContain('npx isreadyai')
    expect(body).toContain(
      'src="https://raw.githubusercontent.com/isreadyai/isreadyai/main/apps/web/app/icon.svg"',
    )
  })
})
