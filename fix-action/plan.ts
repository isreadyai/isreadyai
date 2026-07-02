#!/usr/bin/env bun
/**
 * Fetches a tailored AI fix plan from isready.ai and writes it into the PR body
 * (so the opened pull request carries it) and the GitHub job summary (so it
 * surfaces even when no files changed). Best-effort: any failure exits 0 so it
 * never fails the fix run.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function env(name: string): string | undefined {
  const value = process.env[name]
  return value !== undefined && value.length > 0 ? value : undefined
}

async function main(): Promise<void> {
  const apiKey = env('ISREADYAI_API_KEY')
  const apiUrl = env('ISREADYAI_API_URL') ?? 'https://isready.ai'
  const reportPath = env('REPORT_PATH')
  const fixDir = env('FIX_DIR')
  if (apiKey === undefined || reportPath === undefined || fixDir === undefined) {
    return
  }

  let report: unknown
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch {
    return
  }

  const response = await fetch(`${apiUrl}/api/fix-plan`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ repo: process.env.GITHUB_REPOSITORY ?? 'unknown', report }),
  }).catch(() => null)
  if (response === null || !response.ok) {
    return
  }

  const data = (await response.json().catch(() => null)) as { plan?: string } | null
  const plan = typeof data?.plan === 'string' ? data.plan.trim() : ''
  if (plan.length === 0) {
    return
  }

  const prBody = join(fixDir, 'pr-body.md')
  const section = `\n## AI fix plan\n\n${plan}\n`
  if (existsSync(prBody)) {
    appendFileSync(prBody, section)
  } else {
    writeFileSync(prBody, section.trimStart())
  }

  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary !== undefined) {
    appendFileSync(summary, `# isready.ai — AI fix plan\n\n${plan}\n`)
  }
}

if (import.meta.main) {
  await main()
}
