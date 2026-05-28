import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { countTag, htmlToText, wordCount } from '../../util/html.ts'

// MARK: - Answer-shaped content (GEO)

/**
 * Generative engines lift self-contained, structured passages: data tables,
 * lists and Q&A-style headings are the formats they quote most reliably
 * (2026 GEO guidance: "content extractability").
 */

const def: ICheckDef = {
  id: 'geo.extractability',
  category: ECategory.GEO_CONTENT,
  weight: 2,
  title: 'Content is structured for AI extraction',
}

const DOCS = 'https://arxiv.org/abs/2311.09735'

// Question-shaped headings ("How do I…?", "What is…?") read as liftable Q&A.
const QUESTION_HEADING_RE = /<h[2-4][^>]*>[^<]*\?[^<]*<\/h[2-4]>/gi

const MIN_WORDS = 120

/**
 * Check whether content uses extractable formats: tables, lists, and Q&A-style headings.
 *
 * @export
 */
export const extractabilityCheck = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const words = wordCount(htmlToText(html))

  // Thin pages are judged by content-depth, not structure.
  if (words < MIN_WORDS) {
    return makeResult(
      def,
      EStatus.INFO,
      'too little text to judge extractable structure — see content depth instead',
      { evidence: { wordCount: words } },
    )
  }

  const tables = countTag(html, 'table')
  const lists = countTag(html, 'ul') + countTag(html, 'ol')
  const definitionLists = countTag(html, 'dl')
  const questionHeadings = html.match(QUESTION_HEADING_RE)?.length ?? 0

  const hasTables = tables > 0 || definitionLists > 0
  const hasLists = lists > 0
  const hasQa = questionHeadings > 0
  const formats = [hasTables, hasLists, hasQa].filter(Boolean).length
  const score = formats / 3
  const evidence = { tables, lists, definitionLists, questionHeadings, wordCount: words }

  if (formats >= 2) {
    return makeResult(
      def,
      EStatus.PASS,
      `Content offers ${formats}/3 extractable formats (tables, lists, Q&A headings) — easy for generative engines to quote.`,
      { evidence, score, docsUrl: DOCS },
    )
  }

  if (formats === 1) {
    return makeResult(
      def,
      EStatus.WARN,
      'Content offers only 1/3 extractable formats — AI engines favor tables, lists and Q&A-shaped sections when composing answers.',
      {
        evidence,
        fix: 'Structure key facts as data tables or lists and add question-shaped headings with self-contained answers (Q&A / FAQ sections).',
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        score,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(
    def,
    EStatus.WARN,
    'Content is wall-of-text: no tables, lists or Q&A-shaped sections for generative engines to lift.',
    {
      evidence,
      fix: 'Break prose into lists and tables and add Q&A-style headings — extractable passages are what AI answers actually quote.',
      impact: ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      score: 0.25,
      docsUrl: DOCS,
    },
  )
})
