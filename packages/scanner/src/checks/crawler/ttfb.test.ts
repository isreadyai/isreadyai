import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { ttfbCheck } from './ttfb.ts'

describe('crawler.ttfb', () => {
  it('PASS when TTFB <= 500ms with full score', async () => {
    const ctx = makeContext({ ttfbMs: 200 })
    const res = await ttfbCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
  })

  it('WARN when TTFB between 500 and 1500ms with partial score', async () => {
    const ctx = makeContext({ ttfbMs: 1000 })
    const res = await ttfbCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBeGreaterThan(0)
    expect(res.score).toBeLessThan(1)
  })

  it('FAIL when TTFB > 1500ms', async () => {
    const ctx = makeContext({ ttfbMs: 1800 })
    const res = await ttfbCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })

  it('clamps score to 0 for very slow servers', async () => {
    const ctx = makeContext({ ttfbMs: 5000 })
    const res = await ttfbCheck.run(ctx)
    expect(res.score).toBe(0)
  })
})
