import { describe, expect, test } from 'bun:test'
import { makeContext } from '../testing.ts'
import { uaBlocking } from './crawler/ua-blocking.ts'
import { snippetDirectives } from './crawler/snippet-directives.ts'
import { markdownNegotiation } from './rendering/markdown-negotiation.ts'
import { imageAlt } from './rendering/image-alt.ts'
import { freshness } from './geo/freshness.ts'
import { contentSignalsCheck } from './content-signals.ts'

describe('crawler.ua-blocking', () => {
  test('PASS when AI UA gets the same response', async () => {
    const ctx = makeContext({})
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe('pass')
  })

  test('WARN when GPTBot UA is blocked at server level', async () => {
    const ctx = makeContext({
      onFetchWith: (_url, headers) =>
        headers['user-agent']?.includes('GPTBot') === true
          ? { status: 403, body: 'Forbidden' }
          : undefined,
    })
    const result = await uaBlocking.run(ctx)
    expect(result.status).toBe('warn')
    expect(result.evidence?.gptbotUaStatus).toBe(403)
    expect(result.detail).toContain('discriminating')
  })
})

describe('crawler.snippet-directives', () => {
  test('WARN on nosnippet', async () => {
    const ctx = makeContext({
      body: '<html><head><meta name="robots" content="index, nosnippet"></head><body>x</body></html>',
    })
    const result = await snippetDirectives.run(ctx)
    expect(result.status).toBe('warn')
    expect(result.score).toBe(0)
  })

  test('WARN on tiny max-snippet via header', async () => {
    const ctx = makeContext({ headers: { 'x-robots-tag': 'max-snippet:20' } })
    const result = await snippetDirectives.run(ctx)
    expect(result.status).toBe('warn')
    expect(result.score).toBe(0.5)
  })

  test('PASS with no restrictions', async () => {
    const ctx = makeContext({})
    const result = await snippetDirectives.run(ctx)
    expect(result.status).toBe('pass')
  })
})

describe('rendering.markdown-negotiation', () => {
  test('PASS when text/markdown is served', async () => {
    const ctx = makeContext({
      onFetchWith: (_url, headers) =>
        headers['accept']?.includes('text/markdown') === true
          ? {
              headers: { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' },
              body: '# Hi',
            }
          : undefined,
    })
    const result = await markdownNegotiation.run(ctx)
    expect(result.status).toBe('pass')
  })

  test('INFO (no penalty) when HTML comes back', async () => {
    const ctx = makeContext({})
    const result = await markdownNegotiation.run(ctx)
    expect(result.status).toBe('info')
    expect(result.score).toBe(1)
  })
})

describe('rendering.image-alt', () => {
  test('INFO with no images', async () => {
    const ctx = makeContext({ body: '<html><body><p>text</p></body></html>' })
    const result = await imageAlt.run(ctx)
    expect(result.status).toBe('info')
  })

  test('PASS at high coverage, FAIL at low coverage', async () => {
    const good = makeContext({
      body: '<html><body><img src="a.png" alt="A"><img src="b.png" alt="B"></body></html>',
    })
    expect((await imageAlt.run(good)).status).toBe('pass')

    const bad = makeContext({
      body: '<html><body><img src="a.png"><img src="b.png"><img src="c.png" alt="C"></body></html>',
    })
    const result = await imageAlt.run(bad)
    expect(result.status).toBe('fail')
    expect(result.score).toBeCloseTo(1 / 3)
  })
})

describe('geo.freshness', () => {
  test('PASS with recent dateModified in JSON-LD', async () => {
    const recent = new Date().toISOString()
    const ctx = makeContext({
      body: `<html><head><script type="application/ld+json">{"@type":"Article","dateModified":"${recent}"}</script></head><body>x</body></html>`,
    })
    const result = await freshness.run(ctx)
    expect(result.status).toBe('pass')
  })

  test('WARN with no dates anywhere', async () => {
    const ctx = makeContext({ body: '<html><body>x</body></html>' })
    const result = await freshness.run(ctx)
    expect(result.status).toBe('warn')
    expect(result.score).toBe(0.5)
  })

  test('WARN when stale beyond 18 months', async () => {
    const ctx = makeContext({ headers: { 'last-modified': 'Mon, 01 Jan 2020 00:00:00 GMT' } })
    const result = await freshness.run(ctx)
    expect(result.status).toBe('warn')
    expect(result.detail).toContain('stale')
  })
})

describe('informational discovery checks', () => {
  test('content-signals: INFO, parses signal lines', async () => {
    const ctx = makeContext({
      pages: {
        'https://example.com/robots.txt': {
          status: 200,
          body: 'User-agent: *\nContent-Signal: ai-train=no, search=yes\n',
        },
      },
    })
    const result = await contentSignalsCheck.run(ctx)
    expect(result.status).toBe('info')
    const signals = result.evidence?.signals as string[] | undefined
    expect(signals?.length).toBe(1)
  })
})
