import { validateScanInput } from '@isreadyai/scanner'
import { verifiedDomainBadgeScore } from '@/lib/badge-score'
import { badgeSvg, lockedBadgeSvg } from '@/lib/badge-svg'

// MARK: - GET /badge/[domain](.svg)

/**
 * Renders the host's CURRENT score — but ONLY for a VERIFIED tracked domain.
 * Proven DNS ownership is the authorization (no token), and the score is read
 * from the latest monitored scan, so a badge view never triggers an outbound
 * scan (no DDoS-amplification / SSRF surface). Any other host gets a locked
 * badge: you must add and verify the site on isready.ai to use its badge.
 */

export const maxDuration = 15

interface ICacheTtl {
  /** Fresh window (seconds) the CDN serves the cached badge before revalidating. */
  sMaxAge: number
  /** Extra window (seconds) it may serve the STALE badge while revalidating. */
  swr: number
}

// The locked badge is a TRANSIENT ineligible state: the instant the owner
// verifies, upgrades and activates, the real score must take over. Caching it
// with a day-long stale-while-revalidate kept a now-eligible site showing the
// locked "premium" badge for up to 24h (the deluisa.bio bug). Give it a short TTL
// and an equally short revalidation window so the flip to the real score is ~1min.
const LOCKED_TTL: ICacheTtl = { sMaxAge: 60, swr: 60 }
// Eligible but not yet scored — a scan is imminent, so keep it fresh-ish.
const PENDING_TTL: ICacheTtl = { sMaxAge: 300, swr: 300 }
// A real score is stable and heavier to compute — cache it hard.
const SCORE_TTL: ICacheTtl = { sMaxAge: 21600, swr: 86400 }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
): Promise<Response> {
  const raw = decodeURIComponent((await params).domain).replace(/\.svg$/i, '')
  const validated = validateScanInput(raw)
  if (!validated.ok) {
    return svgResponse(lockedBadgeSvg(), LOCKED_TTL)
  }

  const host = new URL(validated.url).host
  const verified = await verifiedDomainBadgeScore(host)
  if (verified === null) {
    return svgResponse(lockedBadgeSvg(), LOCKED_TTL)
  }
  return svgResponse(
    badgeSvg(verified.score, verified.grade),
    verified.score === null ? PENDING_TTL : SCORE_TTL,
  )
}

// MARK: - internal
function svgResponse(svg: string, ttl: ICacheTtl): Response {
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': `public, s-maxage=${ttl.sMaxAge}, stale-while-revalidate=${ttl.swr}`,
    },
  })
}
