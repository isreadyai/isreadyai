import { describe, expect, test } from 'bun:test'
import type { IFetchProvider, IRawResponse, IScanReport, TUrl } from './types.ts'
import { ECategory } from './types.ts'
import { aggregateSiteFindings, buildStructuralClusters, discoverPages, scanSite } from './crawl.ts'
import { makeRaw } from './testing.ts'
import { allChecks } from './checks/index.ts'
import { structuralFingerprint } from './smart-agent/structural-cluster.ts'

// MARK: - Fixtures

const SITE = 'https://example.com/'

function makeFetcher(pages: Record<TUrl, Partial<IRawResponse>>) {
  return (url: TUrl): Promise<IRawResponse> => {
    const hit = pages[url]
    return Promise.resolve(
      hit !== undefined ? makeRaw(url, hit) : makeRaw(url, { status: 404, body: 'Not found' }),
    )
  }
}

function fixtureProvider(pages: Record<TUrl, Partial<IRawResponse>>): IFetchProvider {
  return { name: 'fixture', rawFetch: makeFetcher(pages) }
}

const HOME_HTML = `<html><head><title>Example home page</title></head><body>
  <a href="/pricing">Pricing</a>
  <a href="/blog/post-1">Post</a>
  <a href="https://example.com/pricing#plans">Pricing again</a>
  <a href="https://other.com/external">External</a>
  <a href="/logo.png">Asset</a>
  <a href="mailto:hi@example.com">Mail</a>
  <p>Hello world content for the checks.</p>
</body></html>`

const SITEMAP = `<?xml version="1.0"?><urlset>
  <loc>https://example.com/</loc>
  <loc>https://example.com/docs/getting-started</loc>
  <loc>https://example.com/about</loc>
</urlset>`

const PAGES: Record<TUrl, Partial<IRawResponse>> = {
  [SITE]: { body: HOME_HTML, headers: { 'content-type': 'text/html' } },
  'https://example.com/robots.txt': {
    body: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
  },
  'https://example.com/sitemap.xml': { body: SITEMAP, headers: { 'content-type': 'text/xml' } },
  'https://example.com/about': {
    body: '<html><head><title>About us page</title></head><body><h1>About</h1></body></html>',
  },
  'https://example.com/pricing': {
    body: '<html><head><title>Pricing page</title></head><body><h1>Pricing</h1></body></html>',
  },
  'https://example.com/docs/getting-started': {
    body: '<html><head><title>Docs</title></head><body><h1>Docs</h1></body></html>',
  },
  'https://example.com/blog/post-1': {
    body: '<html><head><title>Post</title></head><body><h1>Post</h1></body></html>',
  },
}

// MARK: - discoverPages

describe('discoverPages', () => {
  test('merges sitemap and homepage links, same-host only, deduped, shallow-first', async () => {
    const { urls, discovered } = await discoverPages(makeFetcher(PAGES), SITE)
    expect(discovered).toBe(urls.length)
    // Sitemap first (shallow-first), then link-discovered pages; primary excluded.
    expect(urls[0]).toBe('https://example.com/about')
    expect(urls).toContain('https://example.com/docs/getting-started')
    expect(urls).toContain('https://example.com/pricing')
    expect(urls).toContain('https://example.com/blog/post-1')
    // External, assets, mailto and the primary never appear.
    expect(urls.join()).not.toContain('other.com')
    expect(urls.join()).not.toContain('logo.png')
    expect(urls.join()).not.toContain('mailto')
    expect(urls.filter((u) => u.includes('/pricing')).length).toBe(1)
  })

  test('falls back to /sitemap.xml when robots has no directive', async () => {
    const pages = {
      ...PAGES,
      'https://example.com/robots.txt': { body: 'User-agent: *\nAllow: /\n' },
    }
    const { urls } = await discoverPages(makeFetcher(pages), SITE)
    expect(urls).toContain('https://example.com/about')
  })

  test('recurses one level into sitemap indexes', async () => {
    const pages: Record<TUrl, Partial<IRawResponse>> = {
      ...PAGES,
      'https://example.com/sitemap.xml': {
        body: '<sitemapindex><loc>https://example.com/sitemap-pages.xml</loc></sitemapindex>',
      },
      'https://example.com/sitemap-pages.xml': { body: SITEMAP },
    }
    const { urls } = await discoverPages(makeFetcher(pages), SITE)
    expect(urls).toContain('https://example.com/about')
  })
})

// MARK: - scanSite

describe('scanSite', () => {
  test('scans primary + up to limit pages with page-scope checks only', async () => {
    const report = await scanSite(SITE, {
      checks: allChecks,
      providers: [fixtureProvider(PAGES)],
      limit: 2,
    })

    expect(report.pages.length).toBe(2)
    // Discovery is capped per source by maxUrls(=limit) — at least the scanned pages.
    expect(report.discovered).toBeGreaterThanOrEqual(report.pages.length)
    // Site-scope checks ran once (primary), never on subpages.
    const primaryIds = report.primary.checks.map((c) => c.id)
    expect(primaryIds).toContain('crawler.robots.ai-bots')
    for (const page of report.pages) {
      const ids = page.checks.map((c) => c.id)
      expect(ids).not.toContain('crawler.robots.ai-bots')
      expect(ids).not.toContain('crawler.sitemap')
      expect(ids).toContain('structured.meta-basics')
    }
    // Aggregate: primary weighted double.
    const expected = Math.round(
      (report.primary.overall * 2 + report.pages.reduce((s, p) => s + p.overall, 0)) /
        (2 + report.pages.length),
    )
    expect(report.overall).toBe(expected)
  })

  test('counts a page that crashes the engine in `failed`, never in `pages`', async () => {
    const boomUrl = 'https://example.com/about'
    const baseFetch = makeFetcher(PAGES)
    const provider: IFetchProvider = {
      name: 'throwing',
      rawFetch: (url) =>
        url === boomUrl ? Promise.reject(new Error('engine boom')) : baseFetch(url),
    }
    const report = await scanSite(SITE, {
      checks: allChecks,
      providers: [provider],
      limit: 10,
    })
    expect(report.failed ?? 0).toBeGreaterThanOrEqual(1)
    expect(report.pages.map((p) => p.finalUrl)).not.toContain(boomUrl)
  })

  test('limit 0 keeps it a single-page scan', async () => {
    const report = await scanSite(SITE, {
      checks: allChecks,
      providers: [fixtureProvider(PAGES)],
      limit: 0,
    })
    expect(report.pages.length).toBe(0)
    expect(report.overall).toBe(report.primary.overall)
  })

  test('aggregates categories with primary double-weighted, checks emptied', async () => {
    const site = await scanSite(SITE, {
      checks: allChecks,
      providers: [fixtureProvider(PAGES)],
      limit: 2,
    })
    expect(site.categories.length).toBe(site.primary.categories.length)
    for (const aggregate of site.categories) {
      expect(aggregate.checks).toEqual([])
      const base = site.primary.categories.find((c) => c.category === aggregate.category)!
      let weighted = base.score * 2
      let total = 2
      for (const page of site.pages) {
        const match = page.categories.find((c) => c.category === aggregate.category)
        if (match !== undefined && match.checks.length > 0) {
          weighted += match.score
          total += 1
        }
      }
      expect(aggregate.score).toBe(Math.round(weighted / total))
    }
    // Trust on subpages only carries mixed-content — still aggregates fine.
    const trust = site.categories.find((c) => c.category === ECategory.TRUST)
    expect(trust).toBeDefined()
  })
})

// MARK: - aggregateSiteFindings

describe('aggregateSiteFindings', () => {
  test('groups fail/warn by check across pages, failures first, worst representative', async () => {
    const site = await scanSite(SITE, {
      checks: allChecks,
      providers: [fixtureProvider(PAGES)],
      limit: 3,
    })
    const groups = aggregateSiteFindings(site)
    expect(groups.length).toBeGreaterThan(0)
    // Every group only contains fail/warn and lists ≥1 affected page.
    for (const group of groups) {
      expect(['fail', 'warn']).toContain(group.result.status)
      expect(group.pages.length).toBeGreaterThanOrEqual(1)
      expect(group.pages.length).toBeLessThanOrEqual(site.pages.length + 1)
    }
    // Sorted: all failures before the first warning.
    const firstWarn = groups.findIndex((g) => g.result.status === 'warn')
    if (firstWarn !== -1) {
      expect(groups.slice(firstWarn).every((g) => g.result.status === 'warn')).toBe(true)
    }
  })
})

// MARK: - maxUrls & skip

describe('discoverPages maxUrls', () => {
  test('caps stored candidates per source but keeps counting the total', async () => {
    const { urls, discovered } = await discoverPages(makeFetcher(PAGES), SITE, { maxUrls: 1 })
    // 1 from sitemap + 1 from links at most…
    expect(urls.length).toBeLessThanOrEqual(2)
    // …while the true total keeps counting past the cap.
    expect(discovered).toBe(4)
  })
})

describe('scanSite skip', () => {
  test('skips the first N discovered pages', async () => {
    const all = await scanSite(SITE, {
      checks: allChecks,
      providers: [fixtureProvider(PAGES)],
      limit: 4,
    })
    const skipped = await scanSite(SITE, {
      checks: allChecks,
      providers: [fixtureProvider(PAGES)],
      limit: 4,
      skip: 2,
    })
    const allUrls = all.pages.map((p) => p.url)
    const skippedUrls = skipped.pages.map((p) => p.url)
    expect(skippedUrls).toEqual(allUrls.slice(2))
  })
})

// MARK: - buildStructuralClusters

// Minimal distinct layouts for cluster testing.
const BLOG_HTML = `<html><body><main><article><h1>Post</h1><p>Content</p></article></main></body></html>`
const PRICING_HTML = `<html><body><main><section><h2>Plans</h2><table><thead><tr><th>Free</th></tr></thead><tbody><tr><td>$0</td></tr></tbody></table></section></main></body></html>`

function clusterReport(
  url: string,
  html: string,
  overrides: Partial<IScanReport> = {},
): IScanReport {
  return {
    url,
    finalUrl: url,
    scoreVersion: '1',
    overall: 70,
    grade: 'good',
    categories: [],
    checks: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    finishedAt: '2024-01-01T00:00:01.000Z',
    meta: { renderProvider: null, durationMs: 100, fetchOk: true },
    fingerprint: structuralFingerprint(html),
    ...overrides,
  } as IScanReport
}

describe('buildStructuralClusters', () => {
  test('groups structurally identical pages into a single cluster', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML)
    const pages = [
      clusterReport('https://x.com/blog/post-1', BLOG_HTML),
      clusterReport('https://x.com/blog/post-2', BLOG_HTML),
    ]
    const clusters = buildStructuralClusters(primary, pages)
    expect(clusters.length).toBe(1)
    expect(clusters[0].pageCount).toBe(3)
    expect(clusters[0].scannedCount).toBe(3) // all scanned in this helper
    expect(clusters[0].pageUrls).toContain('https://x.com/')
    expect(clusters[0].pageUrls).toContain('https://x.com/blog/post-1')
    expect(clusters[0].pageUrls).toContain('https://x.com/blog/post-2')
  })

  test('produces two clusters for structurally different layouts', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML)
    const pages = [
      clusterReport('https://x.com/blog/post-1', BLOG_HTML),
      clusterReport('https://x.com/pricing', PRICING_HTML),
    ]
    const clusters = buildStructuralClusters(primary, pages)
    expect(clusters.length).toBe(2)
    // Primary and blog land in one cluster; pricing in another.
    const blogCluster = clusters.find((c) => c.pageUrls.includes('https://x.com/'))
    const pricingCluster = clusters.find((c) => c.pageUrls.includes('https://x.com/pricing'))
    expect(blogCluster).toBeDefined()
    expect(pricingCluster).toBeDefined()
    expect(blogCluster?.pageCount).toBe(2)
    expect(pricingCluster?.pageCount).toBe(1)
  })

  test('representativeUrl picks the most-complete page in the cluster', () => {
    // Primary has a low score and fetchOk: false — rich subpage should win.
    const primary = clusterReport('https://x.com/', BLOG_HTML, {
      overall: 30,
      meta: { renderProvider: null, durationMs: 100, fetchOk: false },
    })
    const rich = clusterReport('https://x.com/blog/rich', BLOG_HTML, { overall: 90 })
    const clusters = buildStructuralClusters(primary, [rich])
    expect(clusters[0].representativeUrl).toBe('https://x.com/blog/rich')
  })

  test('avgScore is the rounded mean overall of the cluster members', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML, { overall: 80 })
    const p1 = clusterReport('https://x.com/blog/1', BLOG_HTML, { overall: 60 })
    const p2 = clusterReport('https://x.com/blog/2', BLOG_HTML, { overall: 40 })
    const clusters = buildStructuralClusters(primary, [p1, p2])
    // (80 + 60 + 40) / 3 = 60
    expect(clusters[0].avgScore).toBe(60)
  })

  test('sorted by pageCount desc — dominant template first', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML)
    const pages = [
      clusterReport('https://x.com/blog/1', BLOG_HTML),
      clusterReport('https://x.com/blog/2', BLOG_HTML),
      clusterReport('https://x.com/pricing', PRICING_HTML),
    ]
    const clusters = buildStructuralClusters(primary, pages)
    expect(clusters.length).toBe(2)
    // Blog cluster (3 pages) must come before pricing cluster (1 page).
    expect(clusters[0].pageCount).toBeGreaterThanOrEqual(clusters[1].pageCount)
    expect(clusters[0].pageUrls).toContain('https://x.com/')
  })

  test('only primary, no pages — single cluster of one', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML)
    const clusters = buildStructuralClusters(primary, [])
    expect(clusters.length).toBe(1)
    expect(clusters[0].pageCount).toBe(1)
    expect(clusters[0].pageUrls).toEqual(['https://x.com/'])
    expect(clusters[0].representativeUrl).toBe('https://x.com/')
  })

  test('pages missing fingerprint fall back to empty signature without throwing', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML)
    const noFp = { ...clusterReport('https://x.com/no-fp', BLOG_HTML), fingerprint: undefined }
    expect(() => buildStructuralClusters(primary, [noFp as IScanReport])).not.toThrow()
  })

  test('realistic 3-article + 2-pricing mix yields exactly 2 clusters', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML)
    const pages = [
      clusterReport('https://x.com/blog/1', BLOG_HTML),
      clusterReport('https://x.com/blog/2', BLOG_HTML),
      clusterReport('https://x.com/pricing', PRICING_HTML),
      clusterReport('https://x.com/plans', PRICING_HTML),
    ]
    const clusters = buildStructuralClusters(primary, pages)
    expect(clusters.length).toBe(2)
    const allUrls = clusters.flatMap((c) => c.pageUrls)
    expect(allUrls).toHaveLength(5)
    // Dominant cluster has 3 blog pages; minority has 2 pricing pages.
    expect(clusters[0].pageCount).toBe(3)
    expect(clusters[1].pageCount).toBe(2)
  })

  test('scanSite result carries a non-empty clusters array', async () => {
    const report = await scanSite(SITE, {
      checks: allChecks,
      providers: [fixtureProvider(PAGES)],
      limit: 2,
    })
    expect(Array.isArray(report.clusters)).toBe(true)
    expect(report.clusters.length).toBeGreaterThanOrEqual(1)
    // Every cluster must contain at least the primary's finalUrl in some cluster.
    const allClusteredUrls = report.clusters.flatMap((c) => c.pageUrls)
    expect(allClusteredUrls).toContain(report.primary.finalUrl)
  })

  test('scannedCount equals pageCount when all members were scanned', () => {
    const primary = clusterReport('https://x.com/', BLOG_HTML)
    const pages = [
      clusterReport('https://x.com/blog/1', BLOG_HTML),
      clusterReport('https://x.com/blog/2', BLOG_HTML),
    ]
    const clusters = buildStructuralClusters(primary, pages)
    for (const cluster of clusters) {
      expect(cluster.scannedCount).toBe(cluster.pageCount)
    }
  })
})

// MARK: - Adaptive scan (scanAdaptive via scanSite)

// Simple HTML fixtures re-exported for the adaptive tests.
const BLOG_PAGE_HTML = `<html><head><title>T</title></head><body><main><article><h1>H</h1><p>P</p></article></main></body></html>`
const PRICING_PAGE_HTML = `<html><head><title>P</title></head><body><main><section><h2>Plans</h2><table><thead><tr><th>Free</th></tr></thead><tbody><tr><td>$0</td></tr></tbody></table></section></main></body></html>`

describe('scanSite — adaptive flow', () => {
  // Fixture helpers -------------------------------------------------------

  /** Build an in-memory site with N blog pages under /blog/:n. */
  function makeBlogFixture(n: number): Record<TUrl, Partial<IRawResponse>> {
    const xml = Array.from({ length: n }, (_, i) => `<loc>https://a.com/blog/${i + 1}</loc>`).join(
      '',
    )
    const fixture: Record<TUrl, Partial<IRawResponse>> = {
      'https://a.com/': { body: BLOG_PAGE_HTML, headers: { 'content-type': 'text/html' } },
      'https://a.com/robots.txt': { body: 'User-agent: *\nAllow: /\n' },
      'https://a.com/sitemap.xml': {
        body: `<?xml version="1.0"?><urlset>${xml}</urlset>`,
        headers: { 'content-type': 'text/xml' },
      },
    }
    for (let i = 1; i <= n; i++) {
      fixture[`https://a.com/blog/${i}`] = {
        body: BLOG_PAGE_HTML,
        headers: { 'content-type': 'text/html' },
      }
    }
    return fixture
  }

  /**
   * 8 products pages: products/1-6 are blog-shaped, products/7-8 are pricing-shaped.
   * spreadSample([1..8], 5) picks positions 0,2,4,5,7 → products/1,3,5,6,8 → 4 blog + 1 pricing.
   * This ensures divergence is detected from the sample WITHOUT scanning all 8.
   */
  function makeMixedProductsFixture(): Record<TUrl, Partial<IRawResponse>> {
    const locs = Array.from(
      { length: 8 },
      (_, i) => `<loc>https://a.com/products/${i + 1}</loc>`,
    ).join('')
    const fixture: Record<TUrl, Partial<IRawResponse>> = {
      'https://a.com/': { body: BLOG_PAGE_HTML, headers: { 'content-type': 'text/html' } },
      'https://a.com/robots.txt': { body: 'User-agent: *\nAllow: /\n' },
      'https://a.com/sitemap.xml': {
        body: `<?xml version="1.0"?><urlset>${locs}</urlset>`,
        headers: { 'content-type': 'text/xml' },
      },
    }
    for (let i = 1; i <= 6; i++) {
      fixture[`https://a.com/products/${i}`] = {
        body: BLOG_PAGE_HTML,
        headers: { 'content-type': 'text/html' },
      }
    }
    for (let i = 7; i <= 8; i++) {
      fixture[`https://a.com/products/${i}`] = {
        body: PRICING_PAGE_HTML,
        headers: { 'content-type': 'text/html' },
      }
    }
    return fixture
  }

  // Tests -----------------------------------------------------------------

  test('uniform template group — only the sample is scanned, pageCount covers the full group', async () => {
    // 10 blog posts, all structurally identical → should scan only SAMPLE_PER_TEMPLATE(5), not all 10.
    const fixture = makeBlogFixture(10)
    const report = await scanSite('https://a.com/', {
      checks: allChecks,
      providers: [fixtureProvider(fixture)],
      limit: 10,
    })

    // The blog cluster should cover all 10 discovered URLs but only 5 were scanned.
    const blogCluster = report.clusters.find((c) => c.pageCount === 10)
    expect(blogCluster).toBeDefined()
    expect(blogCluster!.scannedCount).toBeLessThanOrEqual(5)
    // Only scanned pages appear in pages[].
    expect(report.pages.length).toBeLessThanOrEqual(5)
  })

  test('uniform template group — cluster pageCount equals total group size', async () => {
    const fixture = makeBlogFixture(8)
    const report = await scanSite('https://a.com/', {
      checks: allChecks,
      providers: [fixtureProvider(fixture)],
      limit: 8,
    })
    // All 8 blog posts share the same template group (and same structure).
    const total = report.clusters.reduce((sum, c) => sum + c.pageCount, 0)
    // The primary is also a candidate — total across all clusters covers all candidates.
    expect(total).toBeGreaterThanOrEqual(8)
  })

  test('divergent template group — only sample scanned, sub-clusters with proportional pageCount', async () => {
    // 8 products pages: 6 blog-shaped + 2 pricing-shaped (products/7-8).
    // The spread sample of 5 from 8 catches products/1,3,5,6,8 → divergence detected.
    // The expansion branch is gone: no additional pages are scanned beyond the sample.
    const report = await scanSite('https://a.com/', {
      checks: allChecks,
      providers: [fixtureProvider(makeMixedProductsFixture())],
      limit: 8,
    })

    const productsScanned = report.pages.filter((p) => p.url.includes('/products/'))
    // Only the sample was scanned — never more than SAMPLE_PER_TEMPLATE pages.
    expect(productsScanned.length).toBeLessThanOrEqual(5)

    // Both structural layouts appear as separate sub-clusters.
    const productsClusters = report.clusters.filter((c) =>
      c.pageUrls.some((u) => u.includes('/products/')),
    )
    expect(productsClusters.length).toBe(2)

    // pageCounts are proportional estimates summing to the full group size (8).
    const pageCountTotal = productsClusters.reduce((sum, c) => sum + c.pageCount, 0)
    expect(pageCountTotal).toBe(8)

    // scannedCounts reflect only what was actually fetched.
    const scannedTotal = productsClusters.reduce((sum, c) => sum + c.scannedCount, 0)
    expect(scannedTotal).toBeLessThanOrEqual(5)
  })

  test('cluster.scannedCount reflects actual pages scanned for sampled groups', async () => {
    const fixture = makeBlogFixture(10)
    const report = await scanSite('https://a.com/', {
      checks: allChecks,
      providers: [fixtureProvider(fixture)],
      limit: 10,
    })
    for (const cluster of report.clusters) {
      // scannedCount ≤ pageCount always; pageUrls length matches scannedCount.
      expect(cluster.scannedCount).toBeLessThanOrEqual(cluster.pageCount)
      expect(cluster.pageUrls.length).toBe(cluster.scannedCount)
    }
  })

  test('primary always appears in one of the clusters', async () => {
    const fixture = makeBlogFixture(4)
    const report = await scanSite('https://a.com/', {
      checks: allChecks,
      providers: [fixtureProvider(fixture)],
      limit: 4,
    })
    const allClusteredUrls = report.clusters.flatMap((c) => c.pageUrls)
    expect(allClusteredUrls).toContain(report.primary.finalUrl)
  })
})
