import { describe, expect, test } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { PROBED_CRAWLERS } from '../../crawlers.ts'
import { isCrawlerProbe } from '../../crawler-access.ts'
import { uaBlocking } from './ua-blocking.ts'

const ROBOTS_URL = 'https://example.com/robots.txt'

function probesOf(evidence: unknown): unknown[] {
  if (typeof evidence !== 'object' || evidence === null) return []
  const probes = Object.getOwnPropertyDescriptor(evidence, 'probes')?.value
  return Array.isArray(probes) ? probes : []
}

describe('crawler.ua-blocking', () => {
  test('PASS when every probe is served, each sent with its registry user-agent', async () => {
    const sent: string[] = []
    const ctx = makeContext({
      onFetchWith: (_url, headers) => {
        sent.push(headers['user-agent'] ?? '')
        return undefined
      },
    })
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe(EStatus.PASS)
    expect(result.detail).toBe('All 8 AI user-agents get the same response as a browser.')
    const probes = probesOf(result.evidence)
    expect(probes).toHaveLength(8)
    expect(probes.every(isCrawlerProbe)).toBe(true)
    expect(sent.toSorted()).toEqual(PROBED_CRAWLERS.map((c) => c.probeUserAgent).toSorted())
  })

  test('WARN with medium impact when only the ClaudeBot training UA gets 403', async () => {
    const ctx = makeContext({
      onFetchWith: (_url, headers) =>
        headers['user-agent']?.includes('ClaudeBot') === true
          ? { status: 403, body: 'Forbidden' }
          : undefined,
    })
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe(EStatus.WARN)
    expect(result.score).toBeGreaterThan(0.25)
    expect(result.score).toBeLessThan(1)
    expect(result.detail).toContain('ClaudeBot (403)')
    expect(result.impact).toBe('medium')
  })

  test('impact is high when a search or user crawler is refused', async () => {
    const ctx = makeContext({
      onFetchWith: (_url, headers) =>
        headers['user-agent']?.includes('OAI-SearchBot') === true
          ? { status: 403, body: 'Forbidden' }
          : undefined,
    })
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe(EStatus.WARN)
    expect(result.impact).toBe('high')
  })

  test('a 200 challenge page for PerplexityBot is classified as challenged', async () => {
    const ctx = makeContext({
      onFetchWith: (_url, headers) =>
        headers['user-agent']?.includes('PerplexityBot') === true
          ? { status: 200, body: '<html><head><title>Just a moment...</title></head></html>' }
          : undefined,
    })
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe(EStatus.WARN)
    expect(probesOf(result.evidence)).toContainEqual({
      token: 'PerplexityBot',
      status: 200,
      outcome: 'challenged',
    })
    expect(result.detail).toContain('PerplexityBot (challenge page)')
  })

  test('names the silent block when robots.txt allows the refused crawler', async () => {
    const ctx = makeContext({
      pages: { [ROBOTS_URL]: { status: 200, body: 'User-agent: *\nAllow: /\n' } },
      onFetchWith: (_url, headers) =>
        headers['user-agent']?.includes('ClaudeBot') === true ? { status: 403 } : undefined,
    })
    const result = await uaBlocking.run(ctx)
    expect(result.detail).toContain('robots.txt allows ClaudeBot, so nothing in robots.txt shows')
  })

  test('omits the silent block sentence when robots.txt disallows the refused crawler', async () => {
    const ctx = makeContext({
      pages: { [ROBOTS_URL]: { status: 200, body: 'User-agent: ClaudeBot\nDisallow: /\n' } },
      onFetchWith: (_url, headers) =>
        headers['user-agent']?.includes('ClaudeBot') === true ? { status: 403 } : undefined,
    })
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe(EStatus.WARN)
    expect(result.detail).not.toContain('robots.txt allows')
  })

  test('INFO with no probes when the primary fetch fails', async () => {
    const ctx = makeContext({ status: 500 })
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe(EStatus.INFO)
    expect(probesOf(result.evidence)).toHaveLength(0)
    expect(result.evidence).toEqual({ normalStatus: 500 })
  })
})
