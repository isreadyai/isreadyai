import { describe, expect, test } from 'bun:test'
import type { ICheckResult, IScanReport } from './types.ts'
import { buildFixPlan } from './fix-plan.ts'

// MARK: - Fixtures

function makeReport(checks: Partial<ICheckResult>[]): IScanReport {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    scoreVersion: '2026.06.1',
    overall: 70,
    grade: 'moderate',
    categories: [],
    checks: checks as ICheckResult[],
    startedAt: '2026-06-10T10:00:00.000Z',
    finishedAt: '2026-06-10T10:00:05.000Z',
    meta: { renderProvider: null, durationMs: 5000, fetchOk: true },
  } as IScanReport
}

const ROBOTS_FAIL: Partial<ICheckResult> = {
  id: 'crawler.robots.ai-bots',
  status: 'fail',
  category: 'crawler_access',
  title: 'AI crawlers are allowed in robots.txt',
  detail: 'robots.txt fully blocks AI answer crawlers',
  score: 0,
  weight: 5,
  evidence: {
    crawlers: [
      { token: 'GPTBot', purpose: 'training', blocked: true },
      { token: 'OAI-SearchBot', purpose: 'search', blocked: true },
      { token: 'ChatGPT-User', purpose: 'user', blocked: true },
      { token: 'ClaudeBot', purpose: 'training', blocked: false },
    ],
  },
}

const LLMS_MISSING: Partial<ICheckResult> = {
  id: 'llms-txt.present',
  status: 'info',
  category: 'crawler_access',
  title: 'llms.txt',
  detail: 'no llms.txt',
  score: 1,
  weight: 0,
  evidence: { present: false },
}

// MARK: - robots.txt

describe('robotsAllowPatch', () => {
  test('appends allow groups only for blocked search/user crawlers', () => {
    const plan = buildFixPlan(makeReport([ROBOTS_FAIL]), {
      robots: { path: 'public/robots.txt', content: 'User-agent: *\nDisallow: /admin\n' },
    })
    const patch = plan.patches.find((p) => p.checkId === 'crawler.robots.ai-bots')
    expect(patch).toBeDefined()
    expect(patch?.path).toBe('public/robots.txt')
    expect(patch?.content).toContain('User-agent: *\nDisallow: /admin')
    expect(patch?.content).toContain('User-agent: OAI-SearchBot\nAllow: /')
    expect(patch?.content).toContain('User-agent: ChatGPT-User\nAllow: /')
    // Training-only block is a policy choice — never auto-reverted.
    expect(patch?.content).not.toContain('User-agent: GPTBot')
  })

  test('no patch when the repo has no robots file (host-level config)', () => {
    const plan = buildFixPlan(makeReport([ROBOTS_FAIL]), {})
    expect(plan.patches.find((p) => p.checkId === 'crawler.robots.ai-bots')).toBeUndefined()
  })

  test('no patch when the check passed', () => {
    const plan = buildFixPlan(makeReport([{ ...ROBOTS_FAIL, status: 'pass' }]), {
      robots: { path: 'robots.txt', content: 'User-agent: *\nAllow: /\n' },
    })
    expect(plan.patches.find((p) => p.checkId === 'crawler.robots.ai-bots')).toBeUndefined()
  })
})

// MARK: - llms.txt

describe('llmsTxtPatch', () => {
  test('scaffolds public/llms.txt when missing', () => {
    const plan = buildFixPlan(makeReport([LLMS_MISSING]), {})
    const patch = plan.patches.find((p) => p.checkId === 'llms-txt.present')
    expect(patch?.path).toBe('public/llms.txt')
    expect(patch?.content).toContain('# example.com')
  })

  test('no patch when the repo already has one', () => {
    const plan = buildFixPlan(makeReport([LLMS_MISSING]), {
      llms: { path: 'public/llms.txt', content: '# mine' },
    })
    expect(plan.patches.find((p) => p.checkId === 'llms-txt.present')).toBeUndefined()
  })

  test('no patch when the site already serves it', () => {
    const served = { ...LLMS_MISSING, evidence: { present: true } }
    const plan = buildFixPlan(makeReport([served]), {})
    expect(plan.patches.find((p) => p.checkId === 'llms-txt.present')).toBeUndefined()
  })
})

// MARK: - markdown

describe('buildFixPlan', () => {
  test('always includes the LLM markdown plan', () => {
    const plan = buildFixPlan(makeReport([ROBOTS_FAIL]), {})
    expect(plan.markdown).toContain('AI-readiness fix plan for example.com')
  })
})
