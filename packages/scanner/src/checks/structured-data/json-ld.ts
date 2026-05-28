/**
 * JSON-LD structured data check — validates presence of schema.org markup in server-rendered HTML.
 *
 * Parses ld+json out of the served HTML (ctx.raw.body): schema injected client-side is invisible to non-JS AI crawlers,
 * which is the failure mode this surfaces. Scores on identity (Organization/WebSite/Person) and content types.
 *
 * @module checks/structured-data/json-ld
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { extractJsonLd, jsonLdTypes } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'structured.json-ld',
  category: ECategory.STRUCTURED_DATA,
  weight: 5,
  title: 'JSON-LD structured data',
}

const IDENTITY_TYPES = new Set(['Organization', 'WebSite', 'Person'])
const CONTENT_TYPES = new Set([
  'Article',
  'BlogPosting',
  'NewsArticle',
  'Product',
  'SoftwareApplication',
  'FAQPage',
  'HowTo',
  'BreadcrumbList',
])

// MARK: - Check

/**
 * Evaluates presence and richness of JSON-LD schema in the served HTML.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if identity and content types present; WARN if partial; FAIL if no schema.
 * @export
 */
export const jsonLdCheck = defineCheck(def, (ctx) => {
  const blocks = extractJsonLd(ctx.raw.body)

  if (blocks.length === 0) {
    return makeResult(def, EStatus.FAIL, 'no JSON-LD found in the served HTML', {
      fix: 'add schema.org JSON-LD to the HTML the server returns. Schema injected client-side by JS is invisible to non-JS AI crawlers.',
      impact: ELevel.HIGH,
      effort: ELevel.MEDIUM,
      evidence: { blocks: 0, types: [] },
    })
  }

  const types = jsonLdTypes(blocks)
  const hasIdentity = types.some((t) => IDENTITY_TYPES.has(t))
  const hasContent = types.some((t) => CONTENT_TYPES.has(t))

  // 0.5 base for any valid block, +0.25 identity, +0.25 content.
  const score = 0.5 + (hasIdentity ? 0.25 : 0) + (hasContent ? 0.25 : 0)
  const evidence = { blocks: blocks.length, types, hasIdentity, hasContent }

  if (score >= 0.75) {
    return makeResult(def, EStatus.PASS, 'JSON-LD describes identity and/or content', {
      score,
      evidence,
    })
  }

  const missing =
    !hasIdentity && !hasContent
      ? 'no identity (Organization/WebSite/Person) or content (Article/Product/FAQ…) types'
      : !hasIdentity
        ? 'no identity type (Organization/WebSite/Person)'
        : 'no content type (Article/Product/FAQPage/HowTo…)'

  return makeResult(def, EStatus.WARN, `JSON-LD present but ${missing}`, {
    score,
    fix: 'add identity (Organization/WebSite/Person) and content (Article/Product/FAQPage…) schema so AI crawlers can model the page.',
    impact: ELevel.MEDIUM,
    effort: ELevel.MEDIUM,
    evidence,
  })
})
