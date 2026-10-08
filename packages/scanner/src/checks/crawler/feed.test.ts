import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { feedCheck } from './feed.ts'

describe('crawler.feed', () => {
  test('INFO with an RSS link, href resolved against the page URL', async () => {
    const body = '<head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>'
    const res = await feedCheck.run(makeContext({ body, url: 'https://example.com/blog/' }))
    expect(res.status).toBe(EStatus.INFO)
    expect(res.detail).toBe('feed advertised: https://example.com/feed.xml')
    expect(res.evidence?.feeds).toEqual([
      { type: 'application/rss+xml', href: 'https://example.com/feed.xml' },
    ])
  })

  test('INFO for Atom and JSON Feed types', async () => {
    const body = `<link rel="alternate" type="application/atom+xml" href="https://example.com/a">
      <link rel="alternate" type="application/feed+json" href="/j">`
    const res = await feedCheck.run(makeContext({ body }))
    expect(res.evidence?.feeds).toHaveLength(2)
  })

  test('INFO without a feed', async () => {
    const body =
      '<link rel="alternate" hreflang="fr" href="/fr"><link rel="stylesheet" href="/a.css">'
    const res = await feedCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.INFO)
    expect(res.detail).toContain('no RSS, Atom or JSON Feed is advertised')
    expect(res.evidence?.feeds).toEqual([])
  })

  test('never affects the score (weight 0)', () => {
    expect(feedCheck.weight).toBe(0)
  })
})
