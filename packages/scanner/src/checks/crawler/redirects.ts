/**
 * Validates that redirect chains are short and resolve correctly.
 * Long or broken redirect chains cause timeouts for AI crawlers.
 */

import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Redirect chain length

const def: ICheckDef = {
  id: 'crawler.redirects',
  category: ECategory.CRAWLER_ACCESS,
  weight: 2,
  title: 'Redirect chain is short',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://developers.google.com/search/docs/crawling-indexing/301-redirects'

/**
 * Check that redirects resolve quickly without excessive hops or loops.
 *
 * @param ctx - The check context containing raw response and redirect data.
 * @returns A check result indicating pass, warning, or failure status.
 * @export
 */
export const redirectsCheck = defineCheck(def, (ctx) => {
  const { raw } = ctx
  const hops = raw.redirects
  const chain = hops.map((h) => ({ from: h.url, status: h.status, to: h.location }))

  // A redirect loop / over-redirect is fatal: the crawler never reaches content.
  if (raw.error !== undefined && /redirect loop|redirects/i.test(raw.error)) {
    return makeResult(
      def,
      EStatus.FAIL,
      `Redirects never resolve: ${raw.error}. Crawlers abandon the URL without ever reaching content.`,
      {
        evidence: { error: raw.error, hops: chain },
        fix: 'Remove the redirect loop / excessive redirects so the URL resolves to a 200 in one or two hops.',
        impact: ELevel.HIGH,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  if (hops.length >= 3) {
    return makeResult(
      def,
      EStatus.WARN,
      `${hops.length} redirect hops before content. AI fetchers run on 1–5 s budgets, and each extra hop adds latency that can trip their timeout.`,
      {
        evidence: { hopCount: hops.length, hops: chain },
        fix: 'Collapse the chain to a single redirect that points straight at the final URL.',
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  const detail =
    hops.length === 0
      ? 'No redirects — the URL serves content directly.'
      : `${hops.length} redirect hop${hops.length === 1 ? '' : 's'} (within the safe limit).`
  return makeResult(def, EStatus.PASS, detail, {
    evidence: { hopCount: hops.length, hops: chain },
    docsUrl: DOCS,
  })
})
