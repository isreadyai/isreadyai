import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import type { IScanReport, ICheckResult, ICategoryScore } from '@isreadyai/scanner'
import { EStatus, EGrade, ECategory, CATEGORY_LABELS } from '@isreadyai/scanner'
import type { ISmartAgentReport } from '@isreadyai/scanner'
import { ESmartAgentGrade } from '@isreadyai/scanner'
import { renderReport, renderSmartAgentReport, withGutter } from './render.ts'
import { visibleLength } from './ansi.ts'

// MARK: - Fixture

/**
 * A minimal but valid IScanReport: one PASS, one FAIL (with a fix), one WARN,
 * and three INFO checks so the renderer exercises every findings branch.
 */

function check(partial: Partial<ICheckResult> & Pick<ICheckResult, 'id' | 'status'>): ICheckResult {
  return {
    category: ECategory.CRAWLER_ACCESS,
    score: partial.status === EStatus.PASS ? 1 : 0,
    weight: 1,
    title: partial.id,
    detail: 'detail text',
    ...partial,
  }
}

function makeReport(): IScanReport {
  const checks: ICheckResult[] = [
    check({ id: 'http-status', status: EStatus.PASS }),
    check({
      id: 'robots-ai-bots',
      status: EStatus.FAIL,
      detail: 'GPTBot is disallowed in robots.txt',
      fix: 'Remove the Disallow rule for GPTBot',
    }),
    check({ id: 'ttfb', status: EStatus.WARN, detail: 'Slow first byte (1200 ms)' }),
    check({ id: 'note-a', status: EStatus.INFO }),
    check({ id: 'note-b', status: EStatus.INFO }),
    check({ id: 'note-c', status: EStatus.INFO }),
  ]

  const categories: ICategoryScore[] = [
    cat(ECategory.CRAWLER_ACCESS, 62),
    cat(ECategory.RENDERING, 88),
    cat(ECategory.STRUCTURED_DATA, 41),
    cat(ECategory.TRUST, 95),
    cat(ECategory.GEO_CONTENT, 70),
  ]

  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    scoreVersion: '2026.06',
    overall: 67,
    grade: EGrade.MODERATE,
    categories,
    checks,
    startedAt: '2026-06-09T10:00:00.000Z',
    finishedAt: '2026-06-09T10:00:02.000Z',
    meta: { renderProvider: null, durationMs: 2000, fetchOk: true },
  }
}

function cat(category: ICategoryScore['category'], score: number): ICategoryScore {
  return { category, label: CATEGORY_LABELS[category], score, weight: 1, checks: [] }
}

// MARK: - Tests

describe('renderReport', () => {
  test('includes the overall score and grade word', () => {
    const out = strip(renderReport(makeReport()))
    expect(out).toContain('67')
    expect(out).toContain('MODERATE')
  })

  test('shows a ✗ line with id and a → fix arrow for FAIL checks', () => {
    const out = strip(renderReport(makeReport()))
    expect(out).toContain('✗')
    expect(out).toContain('robots-ai-bots')
    expect(out).toContain('GPTBot is disallowed in robots.txt')
    expect(out).toContain('→ Remove the Disallow rule for GPTBot')
  })

  test('shows a ▲ line for WARN checks', () => {
    const out = strip(renderReport(makeReport()))
    expect(out).toContain('▲')
    expect(out).toContain('Slow first byte (1200 ms)')
  })

  test('collapses INFO checks into a single line', () => {
    const out = strip(renderReport(makeReport()))
    expect(out).toContain('3 informational notes')
    expect(out).not.toContain('note-a')
  })

  test('footer carries the summary counts and duration', () => {
    const out = strip(renderReport(makeReport()))
    expect(out).toContain('passed')
    expect(out).toContain('failed')
    expect(out).toContain('scanned in 2000 ms')
    expect(out).toContain('https://isready.ai')
  })
})

describe('renderSmartAgentReport', () => {
  test('keeps the Smart score separate and attributes agent-browser', () => {
    const report: ISmartAgentReport = {
      url: 'https://example.com',
      finalUrl: 'https://example.com/',
      scoreVersion: '2026.06-smart.1',
      overall: 82,
      grade: ESmartAgentGrade.GOOD,
      categories: [],
      signals: [],
      agentView: {
        title: 'Example',
        snapshot: '- main',
        interactiveSnapshot: '- link "Home"',
        interactiveElements: [{ role: 'link', name: 'Home' }],
      },
      startedAt: '2026-06-14T10:00:00.000Z',
      finishedAt: '2026-06-14T10:00:01.000Z',
      meta: {
        provider: 'test',
        durationMs: 1000,
        agentBrowserVersion: '0.27.3',
      },
    }
    const out = strip(renderSmartAgentReport(report))
    expect(out).toContain('Smart Agent Readability')
    expect(out).toContain('82/100')
    expect(out).toContain('agent-browser')
  })
})

// MARK: - Gutter

describe('withGutter', () => {
  test('prefixes every line with the frame gutter, bare on empty lines', () => {
    const out = strip(withGutter('first\n\nsecond'))
    expect(out.split('\n')).toEqual(['│  first', '│', '│  second'])
  })
})

// MARK: - Color suppression

describe('NO_COLOR', () => {
  const original = process.env.NO_COLOR

  beforeEach(() => {
    process.env.NO_COLOR = '1'
  })
  afterEach(() => {
    if (original === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = original
    }
  })

  test('strips all ANSI escapes when NO_COLOR is set', () => {
    const out = renderReport(makeReport())
    // No escape bytes survive, so visible length equals raw length.
    expect(visibleLength(out)).toBe(out.length)
    expect(out).not.toContain('\u001b')
  })
})

// MARK: - Helpers

function strip(text: string): string {
  const esc = String.fromCharCode(27)
  return text.split(new RegExp(`${esc}\\[[0-9;]*m`, 'g')).join('')
}
