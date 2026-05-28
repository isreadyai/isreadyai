import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { wwwConsistencyCheck } from './www-consistency.ts'

const APEX = 'https://example.com/'

describe('crawler.www-consistency', () => {
  it('PASS when host has no www/apex counterpart (subdomain)', async () => {
    const ctx = makeContext({ url: 'https://blog.example.com/' })
    const res = await wwwConsistencyCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('PASS when counterpart redirects to the canonical host', async () => {
    const ctx = makeContext({
      url: APEX,
      pages: {
        'https://www.example.com/': {
          status: 200,
          finalUrl: 'https://example.com/',
          redirects: [
            { url: 'https://www.example.com/', status: 301, location: 'https://example.com/' },
          ],
        },
      },
    })
    const res = await wwwConsistencyCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('PASS when counterpart returns 404', async () => {
    const ctx = makeContext({ url: APEX, pages: { 'https://www.example.com/': { status: 404 } } })
    const res = await wwwConsistencyCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('WARN when counterpart serves 200 without redirecting (host split)', async () => {
    const ctx = makeContext({
      url: APEX,
      pages: {
        'https://www.example.com/': {
          status: 200,
          finalUrl: 'https://www.example.com/',
          redirects: [],
        },
      },
    })
    const res = await wwwConsistencyCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.fix).toBeTruthy()
  })

  it('WARN when counterpart is unreachable (network error)', async () => {
    const ctx = makeContext({
      url: APEX,
      pages: { 'https://www.example.com/': { status: 0, error: 'ENOTFOUND' } },
    })
    const res = await wwwConsistencyCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
  })
})
