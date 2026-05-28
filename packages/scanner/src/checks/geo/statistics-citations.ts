import { ECategory, ELevel, EStatus } from '../../types.ts'
import type { TUrl } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { countTag, htmlToText } from '../../util/html.ts'
import { hostOf } from '../../util/url.ts'

// MARK: - Statistics & citations (GEO)

/**
 * Aggarwal et al. (KDD 2024): adding quotations (+41%) and statistics (+32%)
 * lifts visibility in generative answers.
 */

const def: ICheckDef = {
  id: 'geo.statistics',
  category: ECategory.GEO_CONTENT,
  weight: 2,
  title: 'Content includes statistics, quotations, and external citations',
}

const DOCS = 'https://arxiv.org/abs/2311.09735'

const STAT_RE = /\b\d+([.,]\d+)?\s*(%|percent|million|billion|k\b)/gi
const YEAR_RE = /\b(19|20)\d{2}\b/g
// Quoted spans (curly or straight) longer than 40 chars read as quotations.
const QUOTED_SPAN_RE = /[“"]([^“”"]{41,})[”"]/g
const ANCHOR_RE = /<a\b[^>]*?\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/gi

/**
 * Count statistics (numbers, percentages, years), quotations, and external citations.
 *
 * @export
 */
export const statisticsCitationsCheck = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const text = htmlToText(html)
  const pageHost = safeHost(ctx.raw.finalUrl)

  const stats = (text.match(STAT_RE)?.length ?? 0) + (text.match(YEAR_RE)?.length ?? 0)

  const quotations =
    countTag(html, 'blockquote') + countTag(html, 'q') + (text.match(QUOTED_SPAN_RE)?.length ?? 0)

  let externalCitations = 0
  let m: RegExpExecArray | null
  while ((m = ANCHOR_RE.exec(html)) !== null) {
    const linkHost = safeHost(m[1] ?? '')
    if (linkHost !== null && linkHost !== pageHost) {
      externalCitations++
    }
  }

  const hasStats = stats > 0
  const hasQuotes = quotations > 0
  const hasCitations = externalCitations > 0
  const families = [hasStats, hasQuotes, hasCitations].filter(Boolean).length
  const score = families / 3
  const evidence = { statistics: stats, quotations, externalCitations, families }

  const detail =
    'Quotations lift visibility ~+41% and statistics ~+32% in generative answers (Aggarwal et al., KDD 2024).'

  if (families >= 2) {
    return makeResult(def, EStatus.PASS, `Content has ${families}/3 citation signals. ${detail}`, {
      evidence,
      docsUrl: DOCS,
    })
  }

  if (families === 1) {
    return makeResult(def, EStatus.WARN, `Content has only 1/3 citation signals. ${detail}`, {
      evidence,
      fix: 'Add concrete statistics, direct quotations, and links to authoritative external sources; these are the strongest GEO levers.',
      impact: ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      score,
      docsUrl: DOCS,
    })
  }

  return makeResult(
    def,
    EStatus.WARN,
    `Content has no statistics, quotations, or external citations. ${detail}`,
    {
      evidence,
      fix: 'Add concrete statistics, direct quotations, and links to authoritative external sources; these are the strongest GEO levers.',
      impact: ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      score: 0.25,
      docsUrl: DOCS,
    },
  )
})

// MARK: - internal

/**
 * Extract hostname from URL, returning null on parse error.
 *
 * @param url - The URL to parse.
 * @returns The hostname, or null if the URL is invalid.
 */
function safeHost(url: TUrl): string | null {
  try {
    return hostOf(url)
  } catch {
    return null
  }
}
