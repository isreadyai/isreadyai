import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { htmlToText, wordCount } from '../../util/html.ts'

/**
 * Check whether page has sufficient word count for AI citation (800+ words optimal).
 */

// MARK: - Content depth (GEO)

const def: ICheckDef = {
  id: 'geo.content-depth',
  category: ECategory.GEO_CONTENT,
  weight: 3,
  title: 'Page has enough content to be cited by AI answer engines',
}

const DOCS = 'https://arxiv.org/abs/2311.09735'

/**
 * Assess page word count against AI citation thresholds (PASS ≥800, WARN 300–799, FAIL <300).
 *
 * @export
 */
export const contentDepthCheck = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const words = wordCount(htmlToText(html))

  if (words >= 800) {
    return makeResult(
      def,
      EStatus.PASS,
      `Page has ${words} words — substantial enough for AI citation.`,
      {
        evidence: { wordCount: words },
        docsUrl: DOCS,
      },
    )
  }

  if (words >= 300) {
    return makeResult(
      def,
      EStatus.WARN,
      `Page has ${words} words — thin for AI citation; sub-800-word pages are cited far less.`,
      {
        evidence: { wordCount: words },
        fix: 'Expand the page past ~800 words of substantive, on-topic content. Generative engines disproportionately cite deeper pages.',
        impact: ELevel.MEDIUM,
        effort: ELevel.MEDIUM,
        score: 0.6,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(
    def,
    EStatus.FAIL,
    `Page has only ${words} words — too thin to be cited by AI answer engines.`,
    {
      evidence: { wordCount: words },
      fix: 'Add real, substantive content (aim for 800+ words). Pages under 300 words are rarely surfaced or cited by generative search.',
      impact: ELevel.HIGH,
      effort: ELevel.MEDIUM,
      docsUrl: DOCS,
    },
  )
})
