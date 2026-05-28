import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { countTag, htmlToText, wordCount } from '../../util/html.ts'

/**
 * Check whether page uses proper heading hierarchy (single H1, multiple H2s, ~1 heading per 250 words).
 */

// MARK: - Headings structure (GEO)

const def: ICheckDef = {
  id: 'geo.headings',
  category: ECategory.GEO_CONTENT,
  weight: 2,
  title: 'Page uses a clear heading hierarchy',
}

const DOCS = 'https://arxiv.org/abs/2311.09735'

// One heading per ~250 words signals well-chunked, scannable content.
const WORDS_PER_HEADING = 250

/**
 * Validate heading hierarchy: one H1, ≥2 H2s, and density of ~1 heading per 250 words.
 *
 * @export
 */
export const headingsStructureCheck = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const words = wordCount(htmlToText(html))
  const h1 = countTag(html, 'h1')
  const h2 = countTag(html, 'h2')
  const h3 = countTag(html, 'h3')
  const headings = h1 + h2 + h3

  const hasSingleH1 = h1 === 1
  const hasEnoughH2 = h2 >= 2
  const denseEnough = words > 0 && headings >= words / WORDS_PER_HEADING

  const signals = [hasSingleH1, hasEnoughH2, denseEnough].filter(Boolean).length
  const score = signals / 3
  const evidence = { h1, h2, h3, wordCount: words, hasSingleH1, hasEnoughH2, denseEnough }

  if (signals === 3) {
    return makeResult(def, EStatus.PASS, 'Page has a clear heading hierarchy.', {
      evidence,
      docsUrl: DOCS,
    })
  }

  if (signals === 2) {
    return makeResult(
      def,
      EStatus.WARN,
      'Heading hierarchy is partly weak; AI engines chunk content by headings.',
      {
        evidence,
        fix: 'Use exactly one <h1>, at least two <h2> sections, and roughly one heading per 250 words to make content easy to chunk and cite.',
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        score,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(def, EStatus.FAIL, 'Page lacks a usable heading hierarchy for AI chunking.', {
    evidence,
    fix: 'Add a single <h1>, multiple <h2> section headings, and enough sub-headings so generative engines can segment and cite the page.',
    impact: ELevel.MEDIUM,
    effort: ELevel.LOW,
    score,
    docsUrl: DOCS,
  })
})
