/**
 * Validates that the server responds quickly (TTFB under ~500ms).
 * Slow responses risk timeout from AI crawlers on tight per-request budgets.
 */

import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Time to first byte

const def: ICheckDef = {
  id: 'crawler.ttfb',
  category: ECategory.CRAWLER_ACCESS,
  weight: 2,
  title: 'Server responds quickly (TTFB)',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://web.dev/articles/ttfb'

/**
 * Check that time to first byte (TTFB) is within healthy thresholds for AI crawlers.
 *
 * @param ctx - The check context containing timing data from raw response.
 * @returns A check result indicating pass, warning, or failure status.
 * @export
 */
export const ttfbCheck = defineCheck(def, (ctx) => {
  const ttfb = ctx.raw.timing.ttfbMs
  // Gradient partial credit: full at 500ms, zero by 2000ms.
  const score = Math.max(0, Math.min(1, (2000 - ttfb) / 1500))
  const evidence = { ttfbMs: ttfb }

  const note =
    'AI fetchers operate on short per-request timeouts (often 1–5 s), unlike Googlebot which tolerates slow servers.'

  if (ttfb <= 500) {
    return makeResult(def, EStatus.PASS, `TTFB is ${ttfb} ms — fast.`, {
      evidence,
      score,
      docsUrl: DOCS,
    })
  }

  if (ttfb <= 1500) {
    return makeResult(def, EStatus.WARN, `TTFB is ${ttfb} ms. ${note}`, {
      evidence,
      fix: 'Reduce server response time (caching, CDN, faster origin) to keep TTFB under ~500 ms.',
      impact: ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      score,
      docsUrl: DOCS,
    })
  }

  return makeResult(def, EStatus.FAIL, `TTFB is ${ttfb} ms — too slow. ${note}`, {
    evidence,
    fix: 'Cut TTFB well below 1.5 s via a CDN, edge caching, or origin optimization; slow responses get dropped by AI fetchers.',
    impact: ELevel.HIGH,
    effort: ELevel.MEDIUM,
    score,
    docsUrl: DOCS,
  })
})
