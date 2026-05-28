import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { sitemapCheck } from './sitemap.ts'

const ROBOTS_URL = 'https://example.com/robots.txt'
const SITEMAP_URL = 'https://example.com/sitemap.xml'

describe('crawler.sitemap', () => {
  it('PASS via robots.txt Sitemap directive', async () => {
    const ctx = makeContext({
      pages: {
        [ROBOTS_URL]: {
          status: 200,
          body: 'User-agent: *\nSitemap: https://example.com/sitemap.xml',
        },
        [SITEMAP_URL]: {
          status: 200,
          body: '<?xml version="1.0"?><urlset><url><loc>/</loc></url></urlset>',
        },
      },
    })
    const res = await sitemapCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect((res.evidence as { source: string }).source).toContain('robots.txt')
  })

  it('PASS via /sitemap.xml fallback', async () => {
    const ctx = makeContext({
      pages: { [SITEMAP_URL]: { status: 200, body: '<sitemapindex></sitemapindex>' } },
    })
    const res = await sitemapCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('WARN when sitemap is served but not valid XML', async () => {
    const ctx = makeContext({
      pages: { [SITEMAP_URL]: { status: 200, body: '<html>not a sitemap</html>' } },
    })
    const res = await sitemapCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
  })

  it('WARN when no sitemap is found', async () => {
    const ctx = makeContext({ pages: {} })
    const res = await sitemapCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.fix).toBeTruthy()
  })
})
