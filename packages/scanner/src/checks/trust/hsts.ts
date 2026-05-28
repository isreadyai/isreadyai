/**
 * HSTS header check.
 *
 * Validates presence and strength of Strict-Transport-Security header.
 */

import type { ICheckDef } from '../builder.ts'
import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult } from '../builder.ts'

// MARK: - HSTS header

const def: ICheckDef = {
  id: 'trust.hsts',
  category: ECategory.TRUST,
  weight: 1,
  title: 'Strict-Transport-Security header is present',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://developer.mozilla.org/docs/Web/HTTP/Headers/Strict-Transport-Security'

// One year in seconds; preload lists require at least this.
const MIN_MAX_AGE = 31536000

/**
 * Check for Strict-Transport-Security header presence and strength.
 *
 * @returns Check result for HSTS compliance.
 * @export
 */
export const hstsCheck = defineCheck(def, (ctx) => {
  const value = ctx.raw.headers['strict-transport-security']

  if (value === undefined) {
    return makeResult(def, EStatus.WARN, 'No Strict-Transport-Security header.', {
      evidence: { present: false },
      fix: 'Add a Strict-Transport-Security header (e.g. max-age=31536000; includeSubDomains) to enforce HTTPS on every request.',
      impact: ELevel.LOW,
      effort: ELevel.LOW,
      docsUrl: DOCS,
    })
  }

  const maxAgeMatch = /max-age\s*=\s*(\d+)/i.exec(value)
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : undefined
  const weak = maxAge !== undefined && maxAge < MIN_MAX_AGE

  const detail = weak
    ? `HSTS present but max-age (${maxAge}s) is below the recommended ${MIN_MAX_AGE}s.`
    : 'Strict-Transport-Security header is present.'

  return makeResult(def, EStatus.PASS, detail, {
    evidence: { value, maxAge },
    docsUrl: DOCS,
  })
})
