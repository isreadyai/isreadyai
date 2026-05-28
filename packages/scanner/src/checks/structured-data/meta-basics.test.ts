import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { metaBasicsCheck } from './meta-basics.ts'
import { BARE_HTML, CROSS_HOST_CANONICAL_HTML, LONG_TITLE_HTML, RICH_HTML } from './fixtures.ts'

describe('structured.meta-basics', () => {
  test('PASS when title, description and canonical are all healthy', async () => {
    const res = await metaBasicsCheck.run(makeContext({ body: RICH_HTML }))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
    expect(res.evidence?.canonical).toBe('https://example.com/guide')
  })

  test('FAIL on bare page (no description, no canonical)', async () => {
    const res = await metaBasicsCheck.run(makeContext({ body: BARE_HTML }))
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.detail).toContain('meta description is missing')
    expect(res.detail).toContain('canonical link is missing')
  })

  test('WARN when only the title is too long', async () => {
    const res = await metaBasicsCheck.run(makeContext({ body: LONG_TITLE_HTML }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.detail).toContain('title is too long')
    expect(res.evidence?.titleLength).toBeGreaterThan(70)
  })

  test('flags canonical pointing at another host', async () => {
    const res = await metaBasicsCheck.run(makeContext({ body: CROSS_HOST_CANONICAL_HTML }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.detail).toContain('different host')
  })
})
