/**
 * Anti-bot interstitial detection shared by the anti-bot and per-crawler probe checks.
 */

// MARK: - Cloudflare challenge signals

// Markers found ONLY in a real Cloudflare interstitial, never in normal page
// content or the Turnstile widget. 'cf-turnstile' / 'challenges.cloudflare.com'
// were removed — they match any page embedding Turnstile (e.g. a login form),
// which is a legit control, not a crawler block.
const CF_CHALLENGE_MARKERS = ['_cf_chl_opt', 'cf-browser-verification']

// Interstitial page titles — matched against the <title> only, so legitimate
// content that merely mentions "just a moment" interstitials in prose (like our
// own marketing copy) doesn't trip the check.
const CF_CHALLENGE_TITLES = ['just a moment', 'attention required! | cloudflare']

/**
 * Detects a Cloudflare challenge interstitial in a response body.
 *
 * @param {string} html - The raw response body.
 * @returns {string | null} - The matched marker, `title: <fragment>`, or null when the page is not a challenge.
 * @export
 */
export function challengeSignal(html: string): string | null {
  const body = html.toLowerCase()
  const title = /<title[^>]*>([^<]*)<\/title>/.exec(body)?.[1]?.trim() ?? ''
  const marker = CF_CHALLENGE_MARKERS.find((sig) => body.includes(sig))
  if (marker !== undefined) return marker
  const titleHit = CF_CHALLENGE_TITLES.find((sig) => title.includes(sig))
  return titleHit !== undefined ? `title: ${titleHit}` : null
}
