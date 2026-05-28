import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { statisticsCitationsCheck } from './statistics-citations.ts'
import { RICH_HTML, THIN_HTML } from './fixtures.ts'

// MARK: - geo.statistics

describe('geo.statistics', () => {
  test('PASS when stats, quotes, and external citations are present', async () => {
    const ctx = makeContext({ url: 'https://example.com/', body: RICH_HTML })
    const res = await statisticsCitationsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.families as number).toBeGreaterThanOrEqual(2)
  })

  test('WARN (score 0.25) when no signals at all', async () => {
    const ctx = makeContext({ url: 'https://example.com/', body: THIN_HTML })
    const res = await statisticsCitationsCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBe(0.25)
  })

  test('WARN with exactly one family of signals', async () => {
    // Stats only, no quotes, no external citations.
    const body = '<body><p>Growth was 50% in 2024 and 3 million users.</p></body>'
    const ctx = makeContext({ url: 'https://example.com/', body })
    const res = await statisticsCitationsCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.evidence?.families).toBe(1)
  })

  test('same-host links are not external citations', async () => {
    const body = '<body><p>text</p><a href="https://example.com/internal">internal</a></body>'
    const ctx = makeContext({ url: 'https://example.com/', body })
    const res = await statisticsCitationsCheck.run(ctx)
    expect(res.evidence?.externalCitations).toBe(0)
  })
})
