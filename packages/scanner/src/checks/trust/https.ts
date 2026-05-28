/**
 * HTTPS/TLS connection check.
 *
 * Validates that the site is accessible over HTTPS with a valid certificate.
 */

import type { ICheckDef } from '../builder.ts'
import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult } from '../builder.ts'

// MARK: - HTTPS / TLS

const def: ICheckDef = {
  id: 'trust.https',
  category: ECategory.TRUST,
  weight: 3,
  title: 'Site is served over a valid HTTPS connection',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://developers.google.com/search/docs/crawling-indexing/https'

/**
 * Check for HTTPS availability and valid TLS certificate.
 *
 * @returns Check result for HTTPS and certificate validity.
 * @export
 */
export const httpsCheck = defineCheck(def, (ctx) => {
  const { finalUrl, tls } = ctx.raw

  // A broken TLS chain blocks crawlers even if the URL says https.
  if (tls?.valid === false) {
    return makeResult(
      def,
      EStatus.FAIL,
      'TLS certificate is invalid; crawlers reject the connection.',
      {
        evidence: { finalUrl, tlsError: tls.error },
        fix: 'Install a valid certificate (correct chain, hostname, and not expired). AI crawlers abort on TLS errors.',
        impact: ELevel.HIGH,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  if (!finalUrl.startsWith('https://')) {
    return makeResult(def, EStatus.FAIL, 'Final URL is served over plain HTTP, not HTTPS.', {
      evidence: { finalUrl },
      fix: 'Serve the site over HTTPS and redirect HTTP to HTTPS. AI crawlers and search engines down-rank or skip insecure pages.',
      impact: ELevel.HIGH,
      effort: ELevel.MEDIUM,
      docsUrl: DOCS,
    })
  }

  return makeResult(def, EStatus.PASS, 'Site is served over a valid HTTPS connection.', {
    evidence: { finalUrl, tlsValid: tls?.valid ?? true },
    docsUrl: DOCS,
  })
})
