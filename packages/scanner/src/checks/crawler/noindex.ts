/**
 * Checks for noindex and nofollow meta directives that block indexing and crawling.
 * Ensures pages are visible to crawlers and search engines.
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { extractMetaTags, metaContent } from '../../util/html.ts'

// MARK: - noindex / nofollow directives

const def: ICheckDef = {
  id: 'crawler.noindex',
  category: ECategory.CRAWLER_ACCESS,
  weight: 4,
  title: 'Page is indexable (no noindex)',
}

const DOCS = 'https://developers.google.com/search/docs/crawling-indexing/block-indexing'

/**
 * Check that the page is not blocked by noindex or nofollow directives.
 *
 * @param ctx - The check context containing raw response data.
 * @returns A check result indicating pass, warning, or failure status.
 * @export
 */
export const noindexCheck = defineCheck(def, (ctx) => {
  const { raw } = ctx
  const xRobots = (raw.headers['x-robots-tag'] ?? '').toLowerCase()
  const metaRobots = (metaContent(extractMetaTags(raw.body), 'robots') ?? '').toLowerCase()

  const noindex = xRobots.includes('noindex') || metaRobots.includes('noindex')
  const nofollow = xRobots.includes('nofollow') || metaRobots.includes('nofollow')

  const evidence = {
    xRobotsTag: raw.headers['x-robots-tag'] ?? null,
    metaRobots: metaRobots || null,
  }

  // noindex removes the page from every indexer, including AI search.
  if (noindex) {
    const source = xRobots.includes('noindex') ? 'X-Robots-Tag header' : '<meta name="robots">'
    return makeResult(
      def,
      EStatus.FAIL,
      `The page declares noindex (via ${source}). It is invisible to every indexer, including AI search and answer engines.`,
      {
        evidence,
        fix: 'Remove the noindex directive from the X-Robots-Tag header and the robots meta tag so the page can be indexed.',
        impact: ELevel.HIGH,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  if (nofollow) {
    return makeResult(
      def,
      EStatus.WARN,
      'The page declares nofollow. It can be indexed, but crawlers will not follow its links to discover related content.',
      {
        evidence,
        fix: "Remove the nofollow directive unless you intentionally want crawlers to ignore this page's outbound links.",
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(def, EStatus.PASS, 'No noindex/nofollow directive — the page is indexable.', {
    evidence,
    docsUrl: DOCS,
  })
})
