/**
 * Image alt text coverage check — ensures images carry descriptive alt attributes.
 *
 * Multimodal models and extractors read alt text; images without alts also hurt accessibility.
 * Coverage-based partial scoring to reward high-coverage pages.
 *
 * @module checks/rendering/image-alt
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'rendering.image-alt',
  category: ECategory.RENDERING,
  weight: 1,
  title: 'Images carry alt text',
}

// MARK: - Check

/**
 * Measures alt text coverage across all <img> elements on the page.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if ≥80% coverage, WARN if ≥50%, FAIL if <50%.
 * @export
 */
export const imageAlt = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const imgs = html.match(/<img\b[^>]*>/gi) ?? []
  if (imgs.length === 0) {
    return makeResult(def, EStatus.INFO, 'no <img> elements found — nothing to check', {
      evidence: { images: 0 },
    })
  }
  const withAlt = imgs.filter((tag) => /\balt=["'][^"']+["']/i.test(tag)).length
  const coverage = withAlt / imgs.length
  const evidence = { images: imgs.length, withAlt, coverage: Math.round(coverage * 100) / 100 }

  if (coverage >= 0.8) {
    return makeResult(def, EStatus.PASS, `${withAlt}/${imgs.length} images have alt text`, {
      evidence,
    })
  }
  return makeResult(
    def,
    coverage >= 0.5 ? EStatus.WARN : EStatus.FAIL,
    `only ${withAlt}/${imgs.length} images have alt text — invisible to multimodal extraction`,
    {
      score: coverage,
      fix: 'Add descriptive alt attributes to every meaningful image (empty alt="" for decorative ones).',
      impact: ELevel.MEDIUM,
      effort: ELevel.LOW,
      evidence,
    },
  )
})
