import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { antiBotCheck } from './anti-bot.ts'

describe('crawler.anti-bot', () => {
  it('PASS on a normal 200 response', async () => {
    const ctx = makeContext({ status: 200, body: '<html><body>Welcome</body></html>' })
    const res = await antiBotCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('FAIL on a Cloudflare challenge (403 + cf-mitigated + "Just a moment")', async () => {
    const ctx = makeContext({
      status: 403,
      headers: { 'cf-mitigated': 'challenge', server: 'cloudflare' },
      body: '<html><head><title>Just a moment...</title></head><body>challenges.cloudflare.com</body></html>',
    })
    const res = await antiBotCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.impact).toBe('high')
    expect((res.evidence as { vendor: string }).vendor).toBe('Cloudflare')
    expect(res.detail).toContain('Cloudflare')
  })

  it('FAIL on a Cloudflare body signature without cf-mitigated header', async () => {
    const ctx = makeContext({
      status: 503,
      headers: { server: 'cloudflare' },
      body: '<html><body>Attention Required! | Cloudflare</body></html>',
    })
    const res = await antiBotCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })

  it('WARN on a generic 403 without a vendor fingerprint', async () => {
    const ctx = makeContext({ status: 403, headers: { server: 'nginx' }, body: 'Forbidden' })
    const res = await antiBotCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.fix).toBeTruthy()
  })

  it('WARN on an Akamai reference-# 403 (weaker signal)', async () => {
    const ctx = makeContext({ status: 403, body: 'Access Denied. Reference #18.abcd1234' })
    const res = await antiBotCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect((res.evidence as { vendor: string }).vendor).toBe('Akamai')
  })
})
