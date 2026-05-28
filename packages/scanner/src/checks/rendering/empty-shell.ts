/**
 * Empty shell check — detects SPA shells vs content-bearing HTML via word count + framework fingerprints.
 *
 * Works with no render provider and is raw-HTML-only. Detects SPA shells that ship an empty mount node
 * and defer content to JS. SSR'd apps ship real text and pass on word count alone.
 *
 * @module checks/rendering/empty-shell
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { htmlToText, wordCount } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'rendering.empty-shell',
  category: ECategory.RENDERING,
  weight: 4,
  title: 'Empty HTML shell',
}

// Empty mount nodes for the common SPA frameworks.
const EMPTY_MOUNT_RE = /<div[^>]*id=["'](root|app|__next|___gatsby)["'][^>]*>\s*<\/div>/i

// Framework fingerprints visible in raw HTML even before hydration.
const FINGERPRINT_RES = [/data-reactroot/i, /ng-version=/i, /data-v-app/i, /id=["']__nuxt["']/i]

// MARK: - Check

/**
 * Detects SPA shells that ship an empty mount node with no server-rendered content.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if substantive content (100+ words) is present; FAIL if <30 words + SPA fingerprint; WARN otherwise.
 * @export
 */
export const emptyShell = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const words = wordCount(htmlToText(html))

  if (words >= 100) {
    return makeResult(def, EStatus.PASS, 'initial HTML carries substantive content', {
      evidence: { words },
    })
  }

  const hasFingerprint = EMPTY_MOUNT_RE.test(html) || FINGERPRINT_RES.some((re) => re.test(html))

  if (words < 30 && hasFingerprint) {
    return makeResult(def, EStatus.FAIL, 'page is an empty SPA shell — no content without JS', {
      fix: 'render content server-side (SSR/SSG) so crawlers receive real HTML',
      impact: ELevel.HIGH,
      effort: ELevel.HIGH,
      evidence: { words, hasFingerprint },
    })
  }

  if (words < 30) {
    return makeResult(def, EStatus.WARN, 'near-empty initial HTML', {
      score: 0.5,
      fix: 'ensure primary content is present in the server-rendered HTML',
      impact: ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      evidence: { words, hasFingerprint },
    })
  }

  return makeResult(def, EStatus.WARN, 'thin initial HTML', {
    score: 0.5,
    fix: 'expand the server-rendered content so crawlers have more to index',
    impact: ELevel.MEDIUM,
    effort: ELevel.MEDIUM,
    evidence: { words, hasFingerprint },
  })
})
