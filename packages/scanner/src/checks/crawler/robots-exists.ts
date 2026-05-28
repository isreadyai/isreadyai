/**
 * Validates that robots.txt exists, is reachable, and is parseable.
 * A missing or broken robots.txt limits crawler control and fails to declare sitemaps.
 */

import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { parseRobots } from '../../util/robots.ts'

// MARK: - robots.txt presence

const def: ICheckDef = {
  id: 'crawler.robots.exists',
  category: ECategory.CRAWLER_ACCESS,
  weight: 2,
  title: 'robots.txt is present and parseable',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://developers.google.com/search/docs/crawling-indexing/robots/intro'

/**
 * Check that robots.txt exists, is reachable, and can be parsed successfully.
 *
 * @param ctx - The check context containing URL and fetch methods.
 * @returns A promise resolving to a check result indicating pass, warning, or failure status.
 * @async
 * @export
 */
export const robotsExistsCheck = defineCheck(def, async (ctx) => {
  const robotsUrl = new URL('/robots.txt', ctx.url).toString()
  const res = await ctx.fetchCached(robotsUrl)

  // Network-level failure (DNS, TLS, timeout) surfaces as error / status 0.
  if (res.error !== undefined || res.status === 0) {
    return makeResult(def, EStatus.WARN, 'Could not fetch robots.txt (network error).', {
      evidence: { url: robotsUrl, status: res.status, error: res.error },
      fix: 'Ensure /robots.txt is reachable so crawlers can read your crawl directives and sitemap pointer.',
      impact: ELevel.LOW,
      effort: ELevel.LOW,
      docsUrl: DOCS,
    })
  }

  // 5xx: Google treats an unreachable (5xx) robots.txt as a full disallow.
  if (res.status >= 500) {
    return makeResult(
      def,
      EStatus.FAIL,
      `robots.txt returned ${res.status}; Google treats a 5xx robots.txt as "disallow all", blocking crawling site-wide.`,
      {
        evidence: { url: robotsUrl, status: res.status },
        fix: 'Fix the server error on /robots.txt (return 200 with valid rules, or 404 if you have none). A persistent 5xx halts crawling.',
        impact: ELevel.HIGH,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  // 404 / other 4xx: allowed-by-default, but you lose crawl control + sitemap pointer.
  if (res.status === 404 || res.status >= 400) {
    return makeResult(
      def,
      EStatus.WARN,
      'No robots.txt (404). Crawlers default to allow-all, but you have no place to declare crawl rules or point to your sitemap.',
      {
        evidence: { url: robotsUrl, status: res.status },
        fix: 'Add a /robots.txt (even a minimal allow-all with a Sitemap: line) to gain explicit control and surface your sitemap.',
        impact: ELevel.LOW,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  const body = res.body.trim()
  if (body.length === 0) {
    return makeResult(def, EStatus.WARN, 'robots.txt is empty.', {
      evidence: { url: robotsUrl, status: res.status },
      fix: 'Populate /robots.txt with at least an allow-all group and a Sitemap: directive.',
      impact: ELevel.LOW,
      effort: ELevel.LOW,
      docsUrl: DOCS,
    })
  }

  const robots = parseRobots(res.body)
  return makeResult(def, EStatus.PASS, 'robots.txt is present and parseable.', {
    evidence: {
      url: robotsUrl,
      status: res.status,
      groups: robots.groups.length,
      sitemaps: robots.sitemaps.length,
      warnings: robots.warnings,
    },
    docsUrl: DOCS,
  })
})
