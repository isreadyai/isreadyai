/**
 * Link text check — flags generic or empty anchor text.
 *
 * Crawlers and agents read anchor text as the description of the destination. Links such
 * as "read more" or icon-only links without an accessible name say nothing about where
 * they go.
 *
 * @module checks/geo/link-text
 * @export
 */

import { ECategory, ECheckScope, ELevel, EStatus } from '../../types.ts'
import { extractAnchors } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'geo.link-text',
  category: ECategory.GEO_CONTENT,
  weight: 1,
  title: 'Links say where they go',
  scope: ECheckScope.PAGE,
}

const MIN_LINKS = 5
const MIN_WEAK = 3
const MAX_SHARE = 0.1
const MAX_EXAMPLES = 5
const IGNORED_HREF_RE = /^(?:#|javascript:|mailto:|tel:)/i
const TRAILING_PUNCTUATION_RE = /[\s.,;:!?…→»›>]+$/

const GENERIC_TEXTS: ReadonlySet<string> = new Set([
  'click here',
  'here',
  'read more',
  'learn more',
  'more',
  'this',
  'this link',
  'link',
  'continue',
  'details',
  'more info',
  'find out more',
  'see more',
])

// MARK: - Check

/**
 * Evaluates the share of links whose text is generic or missing.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - PASS with fewer than 5 links or a low weak share; WARN otherwise. Never FAIL.
 * @export
 */
export const linkTextCheck = defineCheck(def, (ctx) => {
  const considered = extractAnchors(ctx.raw.body).filter(
    (a) => a.href.length > 0 && !IGNORED_HREF_RE.test(a.href),
  )

  const generic = considered.filter((a) =>
    GENERIC_TEXTS.has(a.text.toLowerCase().replace(TRAILING_PUNCTUATION_RE, '')),
  )
  const unlabeled = considered.filter((a) => a.text.length === 0 && a.label.length === 0)
  const weakLinks = [...generic, ...unlabeled]
  const weak = weakLinks.length
  const share = considered.length === 0 ? 0 : weak / considered.length
  const evidence = {
    considered: considered.length,
    generic: generic.length,
    unlabeled: unlabeled.length,
    examples: weakLinks.slice(0, MAX_EXAMPLES).map((a) => ({ href: a.href, text: a.text })),
  }

  if (considered.length < MIN_LINKS) {
    return makeResult(
      def,
      EStatus.PASS,
      `too few links to judge link text (${considered.length})`,
      { score: 1, evidence },
    )
  }

  if (weak < MIN_WEAK || share < MAX_SHARE) {
    return makeResult(
      def,
      EStatus.PASS,
      `${weak} of ${considered.length} links use generic or empty text`,
      { score: 1, evidence },
    )
  }

  return makeResult(
    def,
    EStatus.WARN,
    `${weak} of ${considered.length} links use generic or empty text (${Math.round(share * 100)}%)`,
    {
      score: Math.max(0.25, 1 - share),
      fix: 'Rewrite generic link text such as "read more" or "click here" so it names the destination, and give icon-only links an aria-label, so crawlers and agents know what each link points to.',
      impact: ELevel.LOW,
      effort: ELevel.LOW,
      evidence,
    },
  )
})
