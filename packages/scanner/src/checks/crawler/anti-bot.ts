/**
 * Detects anti-bot challenges that block crawler access (Cloudflare, DataDome, Akamai, WAF).
 * Ensures verified AI crawlers can reach your site without being served interstitials or blocks.
 */

import type { TJsonObject } from '../../types.ts'
import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Anti-bot challenge detection

const def: ICheckDef = {
  id: 'crawler.anti-bot',
  category: ECategory.CRAWLER_ACCESS,
  weight: 5,
  title: 'No anti-bot challenge blocks crawlers',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://developers.cloudflare.com/bots/concepts/ai-crawl-control/'

// Markers found ONLY in a real Cloudflare interstitial, never in normal page
// content or the Turnstile widget. 'cf-turnstile' / 'challenges.cloudflare.com'
// were removed — they match any page embedding Turnstile (e.g. a login form),
// which is a legit control, not a crawler block.
const CF_CHALLENGE_MARKERS = ['_cf_chl_opt', 'cf-browser-verification']

// Interstitial page titles — matched against the <title> only, so legitimate
// content that merely mentions "just a moment" interstitials in prose (like our
// own marketing copy) doesn't trip the check.
const CF_CHALLENGE_TITLES = ['just a moment', 'attention required! | cloudflare']

const CF_FIX =
  'Allowlist verified AI crawlers via Cloudflare AI Crawl Control (or your WAF) so GPTBot, ClaudeBot, PerplexityBot et al. are not served a JS challenge.'

/**
 * Check that no anti-bot challenge blocks crawler access.
 *
 * @param ctx - The check context containing raw response and fetch methods.
 * @returns A check result indicating pass, warning, or failure status.
 * @export
 */
export const antiBotCheck = defineCheck(def, (ctx) => {
  const { raw } = ctx
  const headers = raw.headers
  const body = raw.body.toLowerCase()
  const server = (headers['server'] ?? '').toLowerCase()
  const status = raw.status

  const blockedNote =
    'A human browser may pass it, but AI crawlers (which do not execute the challenge) are almost certainly blocked too.'

  // Cloudflare: explicit mitigation header is the strongest signal.
  if ((headers['cf-mitigated'] ?? '').toLowerCase() === 'challenge') {
    return fail(
      `Cloudflare is serving a managed challenge (cf-mitigated: challenge). ${blockedNote}`,
      {
        vendor: 'Cloudflare',
        signal: 'cf-mitigated: challenge',
        status,
      },
    )
  }

  // Cloudflare: 403/503 from a Cloudflare edge.
  if ((status === 403 || status === 503) && server.includes('cloudflare')) {
    return fail(
      `Cloudflare returned ${status} from its edge (server: cloudflare). ${blockedNote}`,
      {
        vendor: 'Cloudflare',
        signal: `status ${status} + server: cloudflare`,
        status,
      },
    )
  }

  // Cloudflare: a real interstitial carries a challenge marker, or its <title>
  // IS the challenge page. A normal 200 that merely mentions these phrases in
  // its content is served fine and is NOT a block.
  const title = /<title[^>]*>([^<]*)<\/title>/.exec(body)?.[1]?.trim() ?? ''
  const cfMarker = CF_CHALLENGE_MARKERS.find((sig) => body.includes(sig))
  const cfTitle = CF_CHALLENGE_TITLES.find((sig) => title.includes(sig))
  if (cfMarker !== undefined || cfTitle !== undefined) {
    return fail(`A Cloudflare anti-bot interstitial was detected in the response. ${blockedNote}`, {
      vendor: 'Cloudflare',
      signal: cfMarker ?? `title: ${cfTitle}`,
      status,
    })
  }

  // DataDome: header or body marker plus a 403.
  const dataDomeHeader = Object.keys(headers).some((k) => k.includes('datadome'))
  if (status === 403 && (dataDomeHeader || body.includes('datadome'))) {
    return makeResult(def, EStatus.FAIL, `DataDome is blocking the request (403). ${blockedNote}`, {
      evidence: {
        vendor: 'DataDome',
        signal: dataDomeHeader ? 'datadome header' : 'datadome in body',
        status,
      },
      fix: 'Configure your DataDome policy to allowlist verified AI crawlers (GPTBot, ClaudeBot, PerplexityBot…) so they receive content rather than a block.',
      impact: ELevel.HIGH,
      effort: ELevel.MEDIUM,
      docsUrl: DOCS,
    })
  }

  // Akamai: weaker signal (reference # on a 403) -> WARN, not FAIL.
  if (status === 403 && /reference #/i.test(raw.body)) {
    return makeResult(
      def,
      EStatus.WARN,
      'Akamai may be challenging the request (403 with an Akamai-style "Reference #" error). AI crawlers could be blocked.',
      {
        evidence: { vendor: 'Akamai', signal: 'reference #', status },
        fix: 'Verify your Akamai bot-management policy allowlists legitimate AI crawlers; serve them content instead of a denial page.',
        impact: ELevel.MEDIUM,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  // Generic 403 without a vendor fingerprint.
  if (status === 403) {
    return makeResult(
      def,
      EStatus.WARN,
      'The site returned 403 Forbidden to the scanner. Some access control is rejecting non-browser clients; AI crawlers may be blocked too.',
      {
        evidence: { vendor: 'unknown', signal: 'generic 403', status },
        fix: 'Check your WAF / server rules. Allow verified AI crawler user-agents and IP ranges instead of returning 403.',
        impact: ELevel.MEDIUM,
        effort: ELevel.MEDIUM,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(def, EStatus.PASS, 'No anti-bot challenge detected in the response.', {
    evidence: { status },
    docsUrl: DOCS,
  })

  // MARK: - internal
  function fail(detail: string, evidence: TJsonObject) {
    return makeResult(def, EStatus.FAIL, detail, {
      evidence,
      fix: CF_FIX,
      impact: ELevel.HIGH,
      effort: ELevel.MEDIUM,
      docsUrl: DOCS,
    })
  }
})
