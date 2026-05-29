import { describe, expect, test } from 'bun:test'
import type { IScanReport } from '../types.ts'
import { sampleRepresentativeUrls, templateKey } from './template-sample.ts'

function page(
  finalUrl: string,
  parts: { overall?: number; fetchOk?: boolean; passes?: number } = {},
): IScanReport {
  const checks = Array.from({ length: parts.passes ?? 0 }, () => ({ status: 'pass' }))
  return {
    finalUrl,
    overall: parts.overall ?? 50,
    checks,
    meta: { fetchOk: parts.fetchOk ?? true, renderProvider: null, durationMs: 1 },
  } as unknown as IScanReport
}

describe('templateKey', () => {
  test('keeps static word routes distinct', () => {
    expect(templateKey('https://x.com/about')).toBe('/about')
    expect(templateKey('https://x.com/about')).not.toBe(templateKey('https://x.com/contact'))
  })

  test('collapses numeric ids, uuids, dates, and id-bearing slugs', () => {
    expect(templateKey('https://x.com/products/12345')).toBe('/products/:n')
    expect(templateKey('https://x.com/u/9f1c2e3a-1111-2222-3333-444455556666')).toBe('/u/:uuid')
    expect(templateKey('https://x.com/news/2024-01-15')).toBe('/news/:date')
    expect(templateKey('https://x.com/blog/iphone-15-pro')).toBe('/blog/:slug')
  })

  test('two pages of the same type share a key; different types do not', () => {
    expect(templateKey('https://x.com/blog/hello-world-2024')).toBe(
      templateKey('https://x.com/blog/another-post-2023'),
    )
    expect(templateKey('https://x.com/products/1')).not.toBe(templateKey('https://x.com/blog/1'))
  })
})

describe('sampleRepresentativeUrls — capped (max provided)', () => {
  test('primary first, one representative per template', () => {
    const urls = sampleRepresentativeUrls(
      'https://x.com/',
      [
        page('https://x.com/blog/post-1-2024'),
        page('https://x.com/blog/post-2-2024'),
        page('https://x.com/about'),
      ],
      20,
    )
    expect(urls[0]).toBe('https://x.com/')
    expect(urls.length).toBe(3)
    expect(urls).toContain('https://x.com/about')
    expect(urls.filter((u) => u.startsWith('https://x.com/blog/')).length).toBe(1)
  })

  test('picks the most-complete page within a template', () => {
    const urls = sampleRepresentativeUrls(
      'https://x.com/',
      [
        page('https://x.com/blog/thin-1', { fetchOk: false, passes: 0, overall: 10 }),
        page('https://x.com/blog/rich-2', { fetchOk: true, passes: 8, overall: 80 }),
      ],
      20,
    )
    expect(urls).toEqual(['https://x.com/', 'https://x.com/blog/rich-2'])
  })

  test('caps to max, keeping the templates with the most pages', () => {
    const pages = [
      page('https://x.com/a/1'),
      page('https://x.com/a/2'),
      page('https://x.com/a/3'),
      page('https://x.com/b/1'),
      page('https://x.com/b/2'),
      page('https://x.com/c/1'),
    ]
    const urls = sampleRepresentativeUrls('https://x.com/', pages, 3)
    expect(urls.length).toBe(3)
    expect(urls[0]).toBe('https://x.com/')
    expect(urls.some((u) => u.startsWith('https://x.com/a/'))).toBe(true)
    expect(urls.some((u) => u.startsWith('https://x.com/b/'))).toBe(true)
    expect(urls.some((u) => u.startsWith('https://x.com/c/'))).toBe(false)
  })
})

describe('sampleRepresentativeUrls — uncapped (no max)', () => {
  test('returns one representative per template, primary first, no cap', () => {
    const pages = [
      page('https://x.com/blog/post-1-2024'),
      page('https://x.com/blog/post-2-2024'),
      page('https://x.com/about'),
      page('https://x.com/contact'),
    ]
    const urls = sampleRepresentativeUrls('https://x.com/', pages)
    expect(urls[0]).toBe('https://x.com/')
    // Three distinct templates: /blog/:slug, /about, /contact → 3 + primary = 4
    expect(urls.length).toBe(4)
    expect(urls.filter((u) => u.startsWith('https://x.com/blog/')).length).toBe(1)
    expect(urls).toContain('https://x.com/about')
    expect(urls).toContain('https://x.com/contact')
  })

  test('picks the most-complete page per template even without a cap', () => {
    const urls = sampleRepresentativeUrls('https://x.com/', [
      page('https://x.com/blog/thin-1', { fetchOk: false, passes: 0, overall: 10 }),
      page('https://x.com/blog/rich-2', { fetchOk: true, passes: 8, overall: 80 }),
    ])
    expect(urls).toEqual(['https://x.com/', 'https://x.com/blog/rich-2'])
  })

  test('includes all templates regardless of how many templates there are', () => {
    // 5 distinct templates: /a/:n, /b/:n, /c/:n, /d/:n, /e/:n
    const pages = [
      page('https://x.com/a/1'),
      page('https://x.com/b/1'),
      page('https://x.com/c/1'),
      page('https://x.com/d/1'),
      page('https://x.com/e/1'),
    ]
    const urls = sampleRepresentativeUrls('https://x.com/', pages)
    // All 5 templates + primary = 6
    expect(urls.length).toBe(6)
    expect(urls[0]).toBe('https://x.com/')
  })

  test('excludes pages sharing the primary template', () => {
    // primary is /, so other / pages would share the same key and be excluded
    const urls = sampleRepresentativeUrls('https://x.com/', [
      page('https://x.com/blog/post-1-2024'),
      page('https://x.com/about'),
    ])
    expect(urls[0]).toBe('https://x.com/')
    expect(urls.length).toBe(3)
  })
})
