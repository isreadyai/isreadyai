import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { htmlToText, tagTextContents, wordCount } from '../../util/html.ts'

/**
 * Check whether main content dominates the page (vs. navigation/chrome).
 */

// MARK: - Content-to-noise ratio (GEO)

const def: ICheckDef = {
  id: 'geo.content-noise',
  category: ECategory.GEO_CONTENT,
  weight: 2,
  title: 'Main content outweighs navigation/chrome',
}

const DOCS = 'https://arxiv.org/abs/2311.09735'

/**
 * Measure main/article content as a ratio of total page words (PASS ≥50%, WARN 25–49%, FAIL <25%).
 *
 * @export
 */
export const contentNoiseCheck = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const totalWords = wordCount(htmlToText(html))

  const mains = tagTextContents(html, 'main')
  const articles = tagTextContents(html, 'article')
  const region = mains[0] ?? articles[0]

  // No semantic container means we cannot isolate content from chrome.
  if (region === undefined) {
    return makeResult(
      def,
      EStatus.INFO,
      'No <main> or <article> — cannot measure content-to-noise ratio. Add semantic <main>.',
      {
        evidence: { hasMain: false, hasArticle: false, totalWords },
        fix: 'Wrap the primary content in a semantic <main> or <article> so crawlers (and this check) can separate content from chrome.',
        impact: ELevel.LOW,
        effort: ELevel.LOW,
        score: 0.5,
        docsUrl: DOCS,
      },
    )
  }

  const mainWords = wordCount(region)
  const ratio = totalWords > 0 ? mainWords / totalWords : 0
  const evidence = { mainWords, totalWords, ratio: Number(ratio.toFixed(2)) }

  if (ratio >= 0.5) {
    return makeResult(def, EStatus.PASS, 'Main content clearly outweighs navigation and chrome.', {
      evidence,
      docsUrl: DOCS,
    })
  }

  if (ratio >= 0.25) {
    return makeResult(
      def,
      EStatus.WARN,
      'Roughly half the page is chrome; main content is diluted.',
      {
        evidence,
        fix: 'Trim boilerplate (nav, sidebars, footers) or expand the <main> content so the primary content dominates the page.',
        impact: ELevel.MEDIUM,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(
    def,
    EStatus.FAIL,
    'Content drowned in chrome; main content is a small fraction of the page.',
    {
      evidence,
      fix: 'Restructure so the <main>/<article> content dominates. Crawlers may treat a chrome-heavy page as low-value.',
      impact: ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      docsUrl: DOCS,
    },
  )
})
