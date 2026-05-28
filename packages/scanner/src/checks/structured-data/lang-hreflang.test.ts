import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { langHreflangCheck } from './lang-hreflang.ts'
import { BARE_HTML, RICH_HTML } from './fixtures.ts'

describe('structured.lang', () => {
  test('PASS with <html lang> and notes hreflang', async () => {
    const res = await langHreflangCheck.run(makeContext({ body: RICH_HTML }))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
    expect(res.evidence?.lang).toBe('en')
    expect(res.detail).toContain('hreflang')
  })

  test('WARN at 0.25 when <html lang> is missing', async () => {
    const res = await langHreflangCheck.run(makeContext({ body: BARE_HTML }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBe(0.25)
    expect(res.fix).toContain('lang')
  })
})
