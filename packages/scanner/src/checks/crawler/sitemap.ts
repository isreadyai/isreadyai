/**
 * Validates that an XML sitemap is discoverable and well-formed.
 * Sitemaps help crawlers efficiently discover and index all pages.
 */

import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { parseRobots } from '../../util/robots.ts'

// MARK: - XML sitemap discovery

const def: ICheckDef = {
  id: 'crawler.sitemap',
  category: ECategory.CRAWLER_ACCESS,
  weight: 2,
  title: 'XML sitemap is discoverable',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://www.sitemaps.org/protocol.html'

/**
 * Check that an XML sitemap is discoverable via robots.txt or /sitemap.xml and is well-formed.
 *
 * @param ctx - The check context containing URL and fetch methods.
 * @returns A promise resolving to a check result indicating pass, warning, or failure status.
 * @async
 * @export
 */
export const sitemapCheck = defineCheck(def, async (ctx) => {
  // Prefer Sitemap: directives in robots.txt, else fall back to /sitemap.xml.
  const robotsUrl = new URL('/robots.txt', ctx.url).toString()
  const robotsRes = await ctx.fetchCached(robotsUrl)
  const robots =
    robotsRes.error === undefined && robotsRes.status >= 200 && robotsRes.status < 400
      ? parseRobots(robotsRes.body)
      : null

  const fromRobots = robots?.sitemaps[0]
  const sitemapUrl = fromRobots ?? new URL('/sitemap.xml', ctx.url).toString()
  const source = fromRobots !== undefined ? 'robots.txt Sitemap directive' : '/sitemap.xml fallback'

  const res = await ctx.fetchCached(sitemapUrl)

  const found = res.error === undefined && res.status >= 200 && res.status < 300
  if (!found) {
    return makeResult(
      def,
      EStatus.WARN,
      'No XML sitemap found. Crawlers must discover every URL by following links, slowing and limiting AI indexing.',
      {
        evidence: {
          sitemapUrl,
          source,
          status: res.status,
          robotsSitemaps: robots?.sitemaps ?? [],
        },
        fix: 'Publish an XML sitemap and reference it with a Sitemap: line in robots.txt.',
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  const body = res.body
  if (!/<urlset|<sitemapindex/i.test(body)) {
    return makeResult(
      def,
      EStatus.WARN,
      'A sitemap was served but is not valid XML (missing <urlset> / <sitemapindex>).',
      {
        evidence: { sitemapUrl, source, status: res.status, bodyPreview: body.slice(0, 120) },
        fix: 'Serve a well-formed XML sitemap with a root <urlset> (or <sitemapindex>) element.',
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(def, EStatus.PASS, `XML sitemap found via ${source}.`, {
    evidence: { sitemapUrl, source, status: res.status },
    docsUrl: DOCS,
  })
})
