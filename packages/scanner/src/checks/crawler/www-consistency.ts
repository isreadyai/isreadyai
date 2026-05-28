/**
 * Validates that www and apex domains are canonicalized to a single host via redirect.
 * Dual-host setups split crawl signals and risk duplicate content indexing.
 */

import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { counterpartHost, hostOf } from '../../util/url.ts'

// MARK: - www / apex canonicalization

const def: ICheckDef = {
  id: 'crawler.www-consistency',
  category: ECategory.CRAWLER_ACCESS,
  weight: 1,
  title: 'Single canonical host (www vs apex)',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://developers.google.com/search/docs/crawling-indexing/canonicalization'

/**
 * Check that www and apex (or subdomain variants) are canonicalized to a single host.
 *
 * @param ctx - The check context containing raw response and fetch methods.
 * @returns A promise resolving to a check result indicating pass, warning, or failure status.
 * @async
 * @export
 */
export const wwwConsistencyCheck = defineCheck(def, async (ctx) => {
  const canonicalHost = hostOf(ctx.raw.finalUrl)
  const counterpart = counterpartHost(canonicalHost)

  // Subdomain (e.g. blog.example.com): no apex/www pairing applies.
  if (counterpart === null) {
    return makeResult(def, EStatus.PASS, 'Host has no www/apex counterpart to reconcile.', {
      evidence: { canonicalHost },
      docsUrl: DOCS,
    })
  }

  const counterpartUrl = `https://${counterpart}/`
  const res = await ctx.fetchCached(counterpartUrl)

  const finalHost = res.error === undefined ? hostOf(res.finalUrl) : null
  const redirectedToCanonical = res.redirects.length > 0 && finalHost === canonicalHost

  if (redirectedToCanonical) {
    return makeResult(
      def,
      EStatus.PASS,
      `The ${counterpart} variant redirects to ${canonicalHost} (single canonical host).`,
      {
        evidence: {
          canonicalHost,
          counterpart,
          counterpartStatus: res.status,
          counterpartFinalHost: finalHost,
        },
        docsUrl: DOCS,
      },
    )
  }

  // Counterpart unreachable (network error).
  if (res.error !== undefined || res.status === 0) {
    return makeResult(
      def,
      EStatus.WARN,
      `The ${counterpart} host is not reachable (${res.error ?? 'no response'}).`,
      {
        evidence: { canonicalHost, counterpart, counterpartStatus: res.status, error: res.error },
        fix: `Either redirect ${counterpart} to ${canonicalHost}, or make it reachable — an unreachable counterpart can confuse crawlers and break inbound links.`,
        impact: ELevel.LOW,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  // 404 on the counterpart: no duplicate content, single host stands.
  if (res.status === 404) {
    return makeResult(
      def,
      EStatus.PASS,
      `The ${counterpart} host returns 404; ${canonicalHost} is the single host.`,
      {
        evidence: { canonicalHost, counterpart, counterpartStatus: res.status },
        docsUrl: DOCS,
      },
    )
  }

  // Counterpart serves a 200 without redirecting: both hosts are live.
  if (res.status >= 200 && res.status < 300) {
    return makeResult(
      def,
      EStatus.WARN,
      `Both ${canonicalHost} and ${counterpart} serve content without redirecting. This host split risks duplicate content and divided crawl signals.`,
      {
        evidence: {
          canonicalHost,
          counterpart,
          counterpartStatus: res.status,
          counterpartFinalHost: finalHost,
        },
        fix: `Pick one canonical host and 301-redirect the other (e.g. ${counterpart} → ${canonicalHost}).`,
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  // Any other status (3xx not to canonical, 5xx…): not a clean single host.
  return makeResult(
    def,
    EStatus.WARN,
    `The ${counterpart} host returned ${res.status} (not a clean redirect to ${canonicalHost}).`,
    {
      evidence: {
        canonicalHost,
        counterpart,
        counterpartStatus: res.status,
        counterpartFinalHost: finalHost,
      },
      fix: `Ensure ${counterpart} 301-redirects to ${canonicalHost} so there is one canonical host.`,
      impact: ELevel.LOW,
      effort: ELevel.LOW,
      docsUrl: DOCS,
    },
  )
})
