import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { authorEeatCheck } from './author-eeat.ts'
import { RICH_HTML } from './fixtures.ts'

describe('structured.author-eeat', () => {
  test('PASS: article in @graph with author + datePublished', async () => {
    const res = await authorEeatCheck.run(makeContext({ body: RICH_HTML }))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.mode).toBe('article')
    expect(res.evidence?.hasAuthor).toBe(true)
    expect(res.evidence?.hasDate).toBe(true)
  })

  test('WARN: article missing datePublished', async () => {
    const body = `<script type="application/ld+json">
      {"@type":"BlogPosting","author":{"name":"Jo"}}
    </script>`
    const res = await authorEeatCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.detail).toContain('datePublished')
  })

  test('FAIL: article with neither author nor date', async () => {
    const body = `<script type="application/ld+json">
      {"@type":"NewsArticle","headline":"x"}
    </script>`
    const res = await authorEeatCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.FAIL)
  })

  test('meta author lifts a missing JSON-LD author to WARN', async () => {
    const body = `<head><meta name="author" content="Jane Doe" /></head>
      <script type="application/ld+json">{"@type":"Article","headline":"x"}</script>`
    const res = await authorEeatCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.evidence?.metaAuthor).toBe(true)
  })

  test('non-article Organization with logo/sameAs PASSes', async () => {
    const body = `<script type="application/ld+json">
      {"@type":"Organization","name":"X","sameAs":["https://x.com/y"]}
    </script>`
    const res = await authorEeatCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.mode).toBe('entity')
  })

  test('non-article without identity WARNs at 0.5', async () => {
    const body = `<script type="application/ld+json">
      {"@type":"WebPage","name":"X"}
    </script>`
    const res = await authorEeatCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBe(0.5)
    expect(res.detail).toContain('E-E-A-T')
  })
})
