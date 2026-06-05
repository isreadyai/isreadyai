import { ciBranchBadgeScore } from '@/lib/ci-reports'
import { badgeSvg, lockedBadgeSvg } from '@/lib/badge-svg'

// MARK: - GET /badge/gh/[slug]/[branch](.svg)

/**
 * Branch-stable repo badge reflecting the latest CI scan on that branch's HEAD.
 * The slug is permanent (1:1 with the immutable repository_id), so the README
 * snippet survives a repo rename or transfer. Gated by the premium plan of the
 * API key that registered the repo — no domain verification needed. Reads the
 * persisted CI score only, so a badge view never triggers an outbound scan.
 */

export const maxDuration = 15

const SLUG_RE = /^gh_[a-f0-9]{8,48}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; branch: string }> },
): Promise<Response> {
  const { slug: rawSlug, branch: rawBranch } = await params
  const slug = decodeURIComponent(rawSlug).replace(/\.svg$/i, '')
  const branch = decodeURIComponent(rawBranch).replace(/\.svg$/i, '')
  if (!SLUG_RE.test(slug)) {
    return svgResponse(lockedBadgeSvg(), 300)
  }

  const badge = await ciBranchBadgeScore(slug, branch)
  if (badge === null) {
    return svgResponse(lockedBadgeSvg(), 300)
  }
  return svgResponse(badgeSvg(badge.score, badge.grade), badge.score === null ? 1800 : 21600)
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
