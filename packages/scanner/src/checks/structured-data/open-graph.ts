/**
 * Open Graph / Twitter card check — validates social/share metadata completeness.
 *
 * Social/share metadata doubles as a compact machine summary many AI surfaces reuse.
 * Scores the four core OG fields plus twitter:card as a 5th signal.
 *
 * @module checks/structured-data/open-graph
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { extractMetaTags, metaContent } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'structured.open-graph',
  category: ECategory.STRUCTURED_DATA,
  weight: 2,
  title: 'Open Graph metadata',
}

const SIGNALS = ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']

// MARK: - Check

/**
 * Evaluates presence of Open Graph and Twitter card meta tags.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if ≥4 signals present; WARN if 2–3; FAIL if <2.
 * @export
 */
export const openGraphCheck = defineCheck(def, (ctx) => {
  const tags = extractMetaTags(ctx.raw.body)

  // metaContent matches on property (og:*) as well as name (twitter:*).
  const present = SIGNALS.filter((key) => {
    const value = metaContent(tags, key)
    return value !== undefined && value.trim().length > 0
  })
  const missing = SIGNALS.filter((key) => !present.includes(key))
  const score = present.length / SIGNALS.length
  const evidence = { present, missing }

  if (present.length >= 4) {
    return makeResult(def, EStatus.PASS, 'core Open Graph signals are present', {
      score,
      evidence,
    })
  }

  const status = present.length >= 2 ? EStatus.WARN : EStatus.FAIL
  return makeResult(def, status, `missing Open Graph signals: ${missing.join(', ')}`, {
    score,
    fix: 'add og:title, og:description, og:image, og:url and twitter:card so share surfaces and AI summaries render correctly.',
    impact: present.length >= 2 ? 'low' : 'medium',
    effort: ELevel.LOW,
    evidence,
  })
})
