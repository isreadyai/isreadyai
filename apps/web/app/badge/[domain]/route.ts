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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
): Promise<Response> {
  const raw = decodeURIComponent((await params).domain).replace(/\.svg$/i, '')
  const validated = validateScanInput(raw)
  if (!validated.ok) {
    return svgResponse(lockedBadgeSvg(), 300)
  }

  const host = new URL(validated.url).host
  const verified = await verifiedDomainBadgeScore(host)
  if (verified === null) {
    return svgResponse(lockedBadgeSvg(), 300)
  }
  return svgResponse(
    badgeSvg(verified.score, verified.grade),
    verified.score === null ? 1800 : 21600,
  )
}

// MARK: - internal
function svgResponse(svg: string, sMaxAge: number): Response {
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400`,
    },
  })
}
