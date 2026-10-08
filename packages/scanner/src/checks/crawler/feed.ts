import { ECategory, ECheckScope, EStatus } from '../../types.ts'
import { extractLinkTags } from '../../util/html.ts'
import { resolveUrl } from '../../util/url.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - RSS / Atom feed discovery (informational)

/**
 * Always INFO, weight 0: Google accepts RSS and Atom feeds as sitemap formats, so an
 * advertised feed is reported for context without touching the score.
 */

const def: ICheckDef = {
  id: 'crawler.feed',
  category: ECategory.CRAWLER_ACCESS,
  weight: 0,
  title: 'RSS or Atom feed (informational)',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap'
const FEED_TYPES: ReadonlySet<string> = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/feed+json',
])

/**
 * Check for an advertised RSS, Atom or JSON Feed (informational, unscored).
 *
 * @export
 */
export const feedCheck = defineCheck(def, (ctx) => {
  const feeds = extractLinkTags(ctx.raw.body)
    .filter(
      (link) =>
        link.rel.toLowerCase().split(/\s+/).includes('alternate') &&
        FEED_TYPES.has(link.type.toLowerCase()) &&
        link.href.length > 0,
    )
    .map((link) => ({
      type: link.type.toLowerCase(),
      href: resolveHref(ctx.raw.finalUrl, link.href),
    }))

  const first = feeds[0]
  if (first !== undefined) {
    return makeResult(def, EStatus.INFO, `feed advertised: ${first.href}`, {
      evidence: { feeds },
      score: 1,
      docsUrl: DOCS,
    })
  }

  return makeResult(
    def,
    EStatus.INFO,
    'no RSS, Atom or JSON Feed is advertised in the page head. Search engines accept feeds as sitemaps; this is reported and never scored.',
    { evidence: { feeds }, score: 1, docsUrl: DOCS },
  )
})

// MARK: - internal

function resolveHref(base: string, href: string): string {
  try {
    return resolveUrl(base, href)
  } catch {
    return href
  }
}
