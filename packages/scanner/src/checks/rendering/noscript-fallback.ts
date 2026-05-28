/**
 * Noscript fallback check — low-weight backstop for non-JS-rendering scenarios.
 *
 * A <noscript> block beats nothing, but AI crawlers index it poorly; no fallback at all leaves them an empty page.
 * Checks for substantive content in raw HTML or noscript blocks to assess crawler readability.
 *
 * @module checks/rendering/noscript-fallback
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { countTag, htmlToText, tagTextContents, wordCount } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'rendering.noscript',
  category: ECategory.RENDERING,
  weight: 1,
  title: 'Noscript fallback',
}

// MARK: - Check

/**
 * Evaluates fallback content availability for non-JS crawlers.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if raw content ≥50 words or script-free; WARN if noscript present; FAIL if no fallback.
 * @export
 */
export const noscriptFallback = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const words = wordCount(htmlToText(html))

  if (words >= 50) {
    return makeResult(def, EStatus.PASS, 'content is present in raw HTML — fallback not needed', {
      evidence: { words },
    })
  }

  // Script-free pages are static, not JS-dependent; thinness is geo.content-depth's concern.
  if (countTag(html, 'script') === 0) {
    return makeResult(def, EStatus.PASS, 'thin page but no JavaScript — nothing hidden behind JS', {
      evidence: { words, scripts: 0 },
    })
  }

  const noscriptWords = tagTextContents(html, 'noscript').reduce(
    (sum, text) => sum + wordCount(text),
    0,
  )

  if (noscriptWords > 20) {
    return makeResult(
      def,
      EStatus.WARN,
      'noscript fallback exists but AI crawlers index it poorly',
      {
        score: 0.5,
        fix: 'serve real content in the initial HTML rather than relying on <noscript>',
        impact: ELevel.LOW,
        effort: ELevel.MEDIUM,
        evidence: { words, noscriptWords },
      },
    )
  }

  return makeResult(def, EStatus.FAIL, 'no fallback at all — crawlers see an empty page', {
    score: 0,
    fix: 'render content server-side so non-JS crawlers receive real HTML',
    impact: ELevel.MEDIUM,
    effort: ELevel.HIGH,
    evidence: { words, noscriptWords },
  })
})
