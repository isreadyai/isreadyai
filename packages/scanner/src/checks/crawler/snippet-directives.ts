/**
 * Checks for nosnippet and max-snippet directives that prevent AI answer surfaces from quoting your content.
 * Even if content is indexed, snippet restrictions mute it from generative AI results.
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { extractMetaTags, metaContent } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Snippet directives

const def: ICheckDef = {
  id: 'crawler.snippet-directives',
  category: ECategory.CRAWLER_ACCESS,
  weight: 1,
  title: 'Snippets are not restricted',
}

/**
 * Check that nosnippet and max-snippet directives do not restrict AI answer surfaces.
 *
 * @param ctx - The check context containing raw response data.
 * @returns A check result indicating pass, warning, or failure status.
 * @export
 */
export const snippetDirectives = defineCheck(def, (ctx) => {
  const headerValue = ctx.raw.headers['x-robots-tag'] ?? ''
  const metaValue = metaContent(extractMetaTags(ctx.raw.body), 'robots') ?? ''
  const combined = `${headerValue},${metaValue}`.toLowerCase()

  if (combined.includes('nosnippet') || /max-snippet\s*:\s*0\b/.test(combined)) {
    return makeResult(
      def,
      EStatus.WARN,
      'nosnippet / max-snippet:0 is declared — AI answer surfaces cannot quote this page',
      {
        score: 0,
        fix: 'Remove nosnippet (or raise max-snippet) so AI search surfaces can cite your content.',
        impact: ELevel.HIGH,
        effort: ELevel.LOW,
        evidence: { headerValue, metaValue },
        docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
      },
    )
  }

  const limited = /max-snippet\s*:\s*([1-9]\d{0,1})\b/.exec(combined)
  if (limited !== null && Number(limited[1]) < 50) {
    return makeResult(
      def,
      EStatus.WARN,
      `max-snippet:${limited[1]} caps quotable text very low for generative answers`,
      {
        score: 0.5,
        fix: 'Raise max-snippet (≥160) or remove the cap.',
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        evidence: { headerValue, metaValue },
        docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
      },
    )
  }

  return makeResult(def, EStatus.PASS, 'no snippet restrictions declared', {
    evidence: { headerValue, metaValue },
  })
})
