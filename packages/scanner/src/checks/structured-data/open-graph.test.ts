import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { openGraphCheck } from './open-graph.ts'
import { BARE_HTML, RICH_HTML } from './fixtures.ts'

describe('structured.open-graph', () => {
  test('PASS with all five signals present', async () => {
    const res = await openGraphCheck.run(makeContext({ body: RICH_HTML }))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
    expect(res.evidence?.missing).toEqual([])
  })

  test('FAIL on bare page (<2 signals)', async () => {
    const res = await openGraphCheck.run(makeContext({ body: BARE_HTML }))
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.detail).toContain('og:title')
  })

  test('WARN with three signals (2–3 band)', async () => {
    const body = `
      <meta property="og:title" content="t" />
      <meta property="og:description" content="d" />
      <meta name="twitter:card" content="summary" />`
    const res = await openGraphCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBeCloseTo(0.6, 5)
    expect(res.evidence?.missing).toEqual(expect.arrayContaining(['og:image', 'og:url']))
  })
})
