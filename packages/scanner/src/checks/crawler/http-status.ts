/**
 * Validates that the URL returns a healthy HTTP 200 status and serves real content.
 * Detects network failures, error status codes, and soft-404 heuristics.
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { extractTitle, htmlToText } from '../../util/html.ts'

// MARK: - HTTP status of the primary URL

const def: ICheckDef = {
  id: 'crawler.http-status',
  category: ECategory.CRAWLER_ACCESS,
  weight: 3,
  title: 'URL returns a healthy 200 status',
}

const DOCS = 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status'

const SOFT_404_RE = /not found|404|page doesn'?t exist/i

/**
 * Check that the URL returns 200 OK and is not a soft-404 error page.
 *
 * @param ctx - The check context containing raw response data.
 * @returns A check result indicating pass, warning, or failure status.
 * @export
 */
export const httpStatusCheck = defineCheck(def, (ctx) => {
  const { raw } = ctx
  const status = raw.status

  // Network failure / no response.
  if (raw.error !== undefined || status === 0) {
    return makeResult(
      def,
      EStatus.FAIL,
      `The URL did not return a response (${raw.error ?? 'no status'}).`,
      {
        evidence: { status, error: raw.error, finalUrl: raw.finalUrl },
        fix: 'Make the URL reachable over HTTPS and return a 200; crawlers index nothing if the request fails.',
        impact: ELevel.HIGH,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  if (status >= 400) {
    return makeResult(
      def,
      EStatus.FAIL,
      `The URL returns ${status}. Crawlers cannot index an error page.`,
      {
        evidence: { status, finalUrl: raw.finalUrl },
        fix: 'Return a 200 for content URLs. Fix the underlying 4xx/5xx so AI crawlers receive the page.',
        impact: ELevel.HIGH,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  if (status === 200) {
    // Soft-404 heuristic: a 200 that is really a "not found" page.
    const title = extractTitle(raw.body) ?? ''
    const bodyText = htmlToText(raw.body).slice(0, 200)
    if (SOFT_404_RE.test(title) || SOFT_404_RE.test(bodyText)) {
      return makeResult(
        def,
        EStatus.WARN,
        'The URL returns 200 but the content looks like a "not found" page (soft 404). Crawlers may index an empty/error page.',
        {
          evidence: { status, title, bodyPreview: bodyText },
          fix: 'Return a real 404 status for missing pages; serve a 200 only when there is genuine content.',
          impact: ELevel.MEDIUM,
          effort: ELevel.MEDIUM,
          docsUrl: DOCS,
        },
      )
    }
    return makeResult(def, EStatus.PASS, 'The URL returns 200 OK.', {
      evidence: { status, finalUrl: raw.finalUrl },
      docsUrl: DOCS,
    })
  }

  // Other 2xx (204/206…): served, but unusual for an indexable page.
  return makeResult(def, EStatus.PASS, `The URL returns ${status} (2xx, but not 200).`, {
    evidence: {
      status,
      finalUrl: raw.finalUrl,
      note: 'Non-200 2xx may not carry indexable content.',
    },
    docsUrl: DOCS,
  })
})
