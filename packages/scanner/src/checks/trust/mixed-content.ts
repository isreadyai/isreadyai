/**
 * Mixed content check.
 *
 * Detects insecure (http://) sub-resources loaded on HTTPS pages.
 */

import type { TUrl } from '../../types.ts'
import type { ICheckDef } from '../builder.ts'
import { ECategory, ELevel, EStatus } from '../../types.ts'
import { defineCheck, makeResult } from '../builder.ts'

// MARK: - Mixed content

const def: ICheckDef = {
  id: 'trust.mixed-content',
  category: ECategory.TRUST,
  weight: 1,
  title: 'No insecure (http://) sub-resources on an HTTPS page',
}

const DOCS = 'https://developer.mozilla.org/docs/Web/Security/Mixed_content'

// Resource tags whose src/href loading insecure http:// is true mixed content.
// Plain <a> anchors are navigation, not sub-resources, so they are excluded.
const MIXED_RE =
  /<(?:script|img|link|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi

/**
 * Check for insecure sub-resources on HTTPS pages.
 *
 * @returns Check result for mixed content detection.
 * @export
 */
export const mixedContentCheck = defineCheck(def, (ctx) => {
  const { finalUrl, body } = ctx.raw

  // Mixed content only applies to HTTPS pages.
  if (!finalUrl.startsWith('https://')) {
    return makeResult(def, EStatus.INFO, 'Page is HTTP; mixed-content check is not applicable.', {
      evidence: { finalUrl },
      docsUrl: DOCS,
    })
  }

  const hits: TUrl[] = []
  let m: RegExpExecArray | null
  while ((m = MIXED_RE.exec(body)) !== null) {
    if (m[1] !== undefined) {
      hits.push(m[1])
    }
  }

  if (hits.length > 0) {
    return makeResult(
      def,
      EStatus.WARN,
      `Found ${hits.length} insecure http:// sub-resource(s) on an HTTPS page.`,
      {
        evidence: { count: hits.length, examples: hits.slice(0, 3) },
        fix: 'Load every sub-resource (scripts, images, stylesheets, iframes) over https://. Browsers block mixed content and it signals a neglected site.',
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(def, EStatus.PASS, 'No insecure http:// sub-resources detected.', {
    evidence: { count: 0 },
    docsUrl: DOCS,
  })
})
