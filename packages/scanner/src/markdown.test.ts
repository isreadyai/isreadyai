import { describe, expect, test } from 'bun:test'
import { reportToMarkdown } from './markdown.ts'
import type { IScanReport } from './types.ts'

// MARK: - fixture

const REPORT: IScanReport = {
  url: 'https://example.com/',
  finalUrl: 'https://example.com/',
  scoreVersion: '2026.06',
  overall: 62,
  grade: 'moderate',
  categories: [
    {
      category: 'structured_data',
      label: 'Structured data',
      score: 24,
      weight: 0.3,
      checks: [],
    },
  ],
  checks: [
    {
      id: 'structured.json-ld',
      category: 'structured_data',
      status: 'fail',
      score: 0,
      weight: 5,
      title: 'JSON-LD structured data',
      detail: 'no JSON-LD found in the served HTML',
      fix: 'add schema.org JSON-LD to the server-rendered HTML',
      impact: 'high',
      effort: 'low',
      evidence: { types: [] },
    },
    {
      id: 'crawler.sitemap',
      category: 'crawler_access',
      status: 'warn',
      score: 0.5,
      weight: 2,
      title: 'Sitemap',
      detail: 'no sitemap.xml found',
      fix: 'publish a sitemap and reference it from robots.txt',
      impact: 'medium',
      effort: 'low',
    },
    {
      id: 'trust.https',
      category: 'trust',
      status: 'pass',
      score: 1,
      weight: 3,
      title: 'HTTPS',
      detail: 'https enforced',
    },
  ],
  startedAt: '2026-06-10T08:00:00.000Z',
  finishedAt: '2026-06-10T08:00:05.000Z',
  meta: { renderProvider: null, durationMs: 5000, fetchOk: true },
}

describe('reportToMarkdown', () => {
  test('human mode: summary table, findings and passed list', () => {
    const md = reportToMarkdown(REPORT, 'human')
    expect(md).toContain('# AI readiness report — example.com')
    expect(md).toContain('**62/100 · MODERATE**')
    expect(md).toContain('| Structured data | 24 | 30% |')
    expect(md).toContain('## ✗ Failed checks')
    expect(md).toContain('### JSON-LD structured data (`structured.json-ld`)')
    expect(md).toContain('**Fix:** add schema.org JSON-LD')
    expect(md).toContain('## ▲ Warnings')
    expect(md).toContain('`trust.https`')
    expect(md).toContain('npx isreadyai example.com')
  })

  test('llm mode: agent instructions, ordered findings, evidence blocks', () => {
    const md = reportToMarkdown(REPORT, 'llm')
    expect(md).toContain('# AI-readiness fix plan for example.com')
    expect(md).toContain('You are an autonomous coding agent')
    expect(md).toContain('do NOT execute JavaScript')
    expect(md).toContain('### 1. [FAIL] JSON-LD structured data')
    expect(md).toContain('### 2. [WARN] Sitemap')
    expect(md).toContain('```json')
    expect(md).toContain('"types": []')
    expect(md).toContain('## Acceptance criteria')
    expect(md).not.toContain('trust.https') // passed checks are not work items
  })

  test('llm mode with clean report: explicit no-action message', () => {
    const clean: IScanReport = {
      ...REPORT,
      checks: [REPORT.checks[2]!],
      overall: 100,
      grade: 'excellent',
    }
    const md = reportToMarkdown(clean, 'llm')
    expect(md).toContain('already AI-ready')
  })
})
