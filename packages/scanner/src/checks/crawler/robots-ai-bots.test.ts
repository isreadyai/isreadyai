import { describe, expect, it } from 'bun:test'
import type { TAiCrawlerVerdict } from '../../crawlers.ts'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { robotsAiBotsCheck } from './robots-ai-bots.ts'

const ROBOTS_URL = 'https://example.com/robots.txt'

type TVerdict = Pick<TAiCrawlerVerdict, 'token' | 'blocked'>

function verdictFor(evidence: unknown, token: string): TVerdict | undefined {
  const crawlers = (evidence as { crawlers: TVerdict[] }).crawlers
  return crawlers.find((c) => c.token === token)
}

describe('crawler.robots.ai-bots', () => {
  it('PASS when no robots.txt blocks anything', async () => {
    const ctx = makeContext({ pages: {} })
    const res = await robotsAiBotsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('PASS when all crawlers explicitly allowed', async () => {
    const ctx = makeContext({
      pages: { [ROBOTS_URL]: { status: 200, body: 'User-agent: *\nDisallow:\n' } },
    })
    const res = await robotsAiBotsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
  })

  it('FAIL when a search crawler (PerplexityBot) is blocked', async () => {
    // Fixture blocks GPTBot (training) + PerplexityBot (search).
    const body = [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: PerplexityBot',
      'Disallow: /',
      '',
      'User-agent: *',
      'Disallow:',
    ].join('\n')
    const ctx = makeContext({ pages: { [ROBOTS_URL]: { status: 200, body } } })
    const res = await robotsAiBotsCheck.run(ctx)

    expect(res.status).toBe(EStatus.FAIL)
    expect(res.impact).toBe('high')
    expect(verdictFor(res.evidence, 'PerplexityBot')?.blocked).toBe(true)
    expect(verdictFor(res.evidence, 'GPTBot')?.blocked).toBe(true)
    // PerplexityBot surface should be named in the detail.
    expect(res.detail).toContain('Perplexity')
    // Score reflects two of six priority tokens blocked.
    expect(res.score).toBeLessThan(1)
  })

  it('WARN when only training crawlers are blocked', async () => {
    const body = [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: Google-Extended',
      'Disallow: /',
      '',
      'User-agent: *',
      'Disallow:',
    ].join('\n')
    const ctx = makeContext({ pages: { [ROBOTS_URL]: { status: 200, body } } })
    const res = await robotsAiBotsCheck.run(ctx)

    expect(res.status).toBe(EStatus.WARN)
    expect(res.detail.toLowerCase()).toContain('training')
    expect(verdictFor(res.evidence, 'GPTBot')?.blocked).toBe(true)
    // Search/user crawlers stay allowed.
    expect(verdictFor(res.evidence, 'OAI-SearchBot')?.blocked).toBe(false)
  })
})
