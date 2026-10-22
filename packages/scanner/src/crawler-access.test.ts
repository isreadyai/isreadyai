import { describe, expect, test } from 'bun:test'
import type { ICheckResult } from './types.ts'
import type { TJsonObject } from './types.ts'
import { AI_CRAWLERS } from './crawlers.ts'
import { crawlerAccessRows, isCrawlerProbe } from './crawler-access.ts'

function check(id: string, evidence: TJsonObject): ICheckResult {
  return {
    id,
    category: 'crawler_access',
    status: 'pass',
    score: 1,
    weight: 1,
    title: id,
    detail: '',
    evidence,
  }
}

function verdicts(blocked: readonly string[] = []): TJsonObject[] {
  return AI_CRAWLERS.map((c) => ({
    token: c.token,
    operator: c.operator,
    purpose: c.purpose,
    surface: c.surface,
    blocked: blocked.includes(c.token),
  }))
}

const robotsCheck = (blocked: readonly string[] = []) =>
  check('crawler.robots.ai-bots', { crawlers: verdicts(blocked) })

describe('crawlerAccessRows', () => {
  test('joins robots verdicts with probes and flags silent blocks', () => {
    const rows = crawlerAccessRows([
      robotsCheck(['GPTBot']),
      check('crawler.ua-blocking', {
        normalStatus: 200,
        probes: [
          { token: 'GPTBot', status: 403, outcome: 'refused' },
          { token: 'ClaudeBot', status: 403, outcome: 'refused' },
          { token: 'PerplexityBot', status: 200, outcome: 'served' },
        ],
      }),
    ])
    expect(rows).not.toBeNull()
    const byToken = new Map(rows?.map((r) => [r.token, r]))
    expect(byToken.get('GPTBot')).toMatchObject({ robots: 'blocked', silentBlock: false })
    expect(byToken.get('ClaudeBot')).toMatchObject({ robots: 'allowed', silentBlock: true })
    expect(byToken.get('PerplexityBot')).toMatchObject({ robots: 'allowed', silentBlock: false })
    expect(byToken.get('Googlebot')?.probe).toBeNull()
  })

  test('no robots.txt yields no-robots rows and a silent block when refused', () => {
    const rows = crawlerAccessRows([
      check('crawler.robots.ai-bots', { robotsPresent: false }),
      check('crawler.ua-blocking', {
        normalStatus: 200,
        probes: [{ token: 'GPTBot', status: 0, outcome: 'no-response' }],
      }),
    ])
    expect(rows).toHaveLength(AI_CRAWLERS.length)
    expect(rows?.every((r) => r.robots === 'no-robots')).toBe(true)
    expect(rows?.find((r) => r.token === 'GPTBot')?.silentBlock).toBe(true)
  })

  test('returns null when the robots check is missing or carries no usable data', () => {
    expect(crawlerAccessRows([])).toBeNull()
    expect(crawlerAccessRows([check('crawler.robots.ai-bots', { url: 'x' })])).toBeNull()
    expect(
      crawlerAccessRows([check('crawler.robots.ai-bots', { crawlers: [{ token: 1 }] })]),
    ).toBeNull()
  })

  test('legacy ua-blocking evidence leaves every probe null', () => {
    const rows = crawlerAccessRows([
      robotsCheck(),
      check('crawler.ua-blocking', { normalStatus: 200, gptbotUaStatus: 403 }),
    ])
    expect(rows?.every((r) => r.probe === null && !r.silentBlock)).toBe(true)
  })

  test('ignores malformed probe entries', () => {
    const rows = crawlerAccessRows([
      robotsCheck(),
      check('crawler.ua-blocking', {
        probes: [
          { token: 'GPTBot', status: '403', outcome: 'refused' },
          { token: 'ClaudeBot', status: 403, outcome: 'exploded' },
          'junk',
        ],
      }),
    ])
    expect(rows?.every((r) => r.probe === null)).toBe(true)
  })

  test('orders probed rows first, each group in registry order', () => {
    const rows = crawlerAccessRows([
      robotsCheck(),
      check('crawler.ua-blocking', {
        probes: [
          { token: 'PerplexityBot', status: 200, outcome: 'served' },
          { token: 'ClaudeBot', status: 200, outcome: 'served' },
        ],
      }),
    ])
    expect(rows?.slice(0, 2).map((r) => r.token)).toEqual(['ClaudeBot', 'PerplexityBot'])
    expect(rows?.[2]?.token).toBe('GPTBot')
  })
})

describe('isCrawlerProbe', () => {
  test('accepts a well-formed probe and rejects other shapes', () => {
    expect(isCrawlerProbe({ token: 'GPTBot', status: 200, outcome: 'served' })).toBe(true)
    expect(isCrawlerProbe(null)).toBe(false)
    expect(isCrawlerProbe({ token: 'GPTBot' })).toBe(false)
  })
})
