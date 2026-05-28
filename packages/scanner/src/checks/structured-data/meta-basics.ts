/**
 * Meta basics check — validates title, meta description, and canonical presence and quality.
 *
 * Title, meta description and canonical in the served HTML are the primary machine-readable summary signals
 * AI crawlers index a page by. Scores all three for length and presence.
 *
 * @module checks/structured-data/meta-basics
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import type { TUrl } from '../../types.ts'
import { extractCanonical, extractMetaTags, extractTitle, metaContent } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'structured.meta-basics',
  category: ECategory.STRUCTURED_DATA,
  weight: 4,
  title: 'Title, description & canonical',
}

const TITLE_MIN = 10
const TITLE_MAX = 70
const DESC_MIN = 50
const DESC_MAX = 160

// MARK: - Check

/**
 * Evaluates presence and length constraints on title, description, and canonical.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if all three are present and properly sized; WARN/FAIL per issue count.
 * @export
 */
export const metaBasicsCheck = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const tags = extractMetaTags(html)

  const title = extractTitle(html)
  const titleLen = title?.length ?? 0
  const description = metaContent(tags, 'description') ?? null
  const descLen = description?.length ?? 0
  const canonical = extractCanonical(html)

  const issues: string[] = []

  if (title === null || titleLen === 0) {
    issues.push('title is missing')
  } else if (titleLen < TITLE_MIN) {
    issues.push(`title is too short (${titleLen} chars, want ${TITLE_MIN}–${TITLE_MAX})`)
  } else if (titleLen > TITLE_MAX) {
    issues.push(`title is too long (${titleLen} chars, want ${TITLE_MIN}–${TITLE_MAX})`)
  }

  if (description === null || descLen === 0) {
    issues.push('meta description is missing')
  } else if (descLen < DESC_MIN) {
    issues.push(`meta description is too short (${descLen} chars, want ${DESC_MIN}–${DESC_MAX})`)
  } else if (descLen > DESC_MAX) {
    issues.push(`meta description is too long (${descLen} chars, want ${DESC_MIN}–${DESC_MAX})`)
  }

  const canonicalIssue = checkCanonical(canonical, ctx.raw.finalUrl)
  if (canonicalIssue !== null) {
    issues.push(canonicalIssue)
  }

  const score = Math.max(0, (3 - issues.length) / 3)
  const evidence = { titleLength: titleLen, descriptionLength: descLen, canonical }

  if (issues.length === 0) {
    return makeResult(def, EStatus.PASS, 'title, description and canonical are all healthy', {
      score,
      evidence,
    })
  }

  const status = issues.length >= 2 ? EStatus.FAIL : EStatus.WARN
  return makeResult(def, status, issues.join('; '), {
    score,
    fix: 'set a 10–70 char <title>, a 50–160 char meta description, and an absolute same-host <link rel="canonical">.',
    impact: issues.length >= 2 ? ELevel.HIGH : ELevel.MEDIUM,
    effort: ELevel.LOW,
    evidence,
  })
})

// MARK: - Helpers

/**
 * Validates canonical URL: must be absolute and point to the same host as finalUrl.
 *
 * @param {string | null} canonical - The canonical URL from the HTML (may be relative or null).
 * @param {TUrl} finalUrl - The final URL of the page for host comparison.
 * @returns {string | null} - An error message if invalid, null if valid.
 */
function checkCanonical(canonical: string | null, finalUrl: TUrl): string | null {
  if (canonical === null || canonical.length === 0) {
    return 'canonical link is missing'
  }
  let parsed: URL
  try {
    parsed = new URL(canonical)
  } catch {
    return `canonical is not an absolute URL (${canonical})`
  }
  const finalHost = new URL(finalUrl).host
  if (parsed.host !== finalHost) {
    return `canonical points to a different host (${parsed.host} ≠ ${finalHost})`
  }
  return null
}
