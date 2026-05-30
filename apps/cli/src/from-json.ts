#!/usr/bin/env bun
/**
 * Renders Markdown from a saved --json report without re-scanning.
 *
 * Usage: `bun apps/cli/src/from-json.ts report.json [--llm]`
 *
 * Lets the GitHub Action scan once and emit both formats. Accepts both a
 * single-page report and a --deep ISiteReport (rendered from its primary page,
 * with a crawl summary header).
 */

import { readFile } from 'node:fs/promises'
import { isScanReport, isSiteReport, reportToMarkdown } from '@isreadyai/scanner'

const file = process.argv[2]
if (file === undefined) {
  process.stderr.write('usage: from-json <report.json> [--llm]\n')
  process.exit(2)
}

const mode = process.argv.includes('--llm') ? 'llm' : 'human'
const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))

if (isSiteReport(parsed)) {
  // Pass the full ISiteReport so reportToMarkdown includes the structural-templates section.
  process.stdout.write(`${reportToMarkdown(parsed, mode)}\n`)
} else if (isScanReport(parsed)) {
  process.stdout.write(`${reportToMarkdown(parsed, mode)}\n`)
} else {
  process.stderr.write(`error: ${file} is not an isreadyai --json report\n`)
  process.exit(2)
}
