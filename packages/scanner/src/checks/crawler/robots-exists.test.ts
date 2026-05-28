import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { robotsExistsCheck } from './robots-exists.ts'

const ROBOTS_URL = 'https://example.com/robots.txt'

describe('crawler.robots.exists', () => {
  it('PASS when robots.txt is present and parseable', async () => {
    const ctx = makeContext({
      pages: {
        [ROBOTS_URL]: {
          status: 200,
          body: 'User-agent: *\nDisallow:\nSitemap: https://example.com/sitemap.xml',
        },
      },
    })
    const res = await robotsExistsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('WARN when robots.txt is 404', async () => {
    const ctx = makeContext({ pages: {} })
    const res = await robotsExistsCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.fix).toBeTruthy()
  })

  it('FAIL when robots.txt returns 5xx', async () => {
    const ctx = makeContext({ pages: { [ROBOTS_URL]: { status: 503, body: 'down' } } })
    const res = await robotsExistsCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.impact).toBe('high')
  })

  it('WARN on network error', async () => {
    const ctx = makeContext({
      pages: { [ROBOTS_URL]: { status: 0, error: 'getaddrinfo ENOTFOUND' } },
    })
    const res = await robotsExistsCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
  })
})
