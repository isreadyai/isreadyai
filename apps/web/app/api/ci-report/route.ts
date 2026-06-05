import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isScanReport, isSiteReport } from '@isreadyai/scanner'
import { apiKeyOwnerId, verifyApiKey } from '@/lib/api-keys'
import { isPaidPlan } from '@/lib/plans'
import { persistCiReport, CiRepoTakeoverError } from '@/lib/ci-reports'

// MARK: - POST /api/ci-report

/**
 * Authenticated CI report upload from the audit action. Strictly API-key
 * authenticated and premium-gated. Persists the uploaded scan stamped
 * source='action', keyed by the IMMUTABLE repository_id (never owner/repo), and
 * returns the repo's stable badge + report URLs. This upload IS the action's
 * telemetry — the action never also calls /api/telemetry.
 */

export const maxDuration = 30

const MAX_BODY_BYTES = 4_000_000

const BodySchema = z.object({
  // GitHub's numeric repository id — immutable across rename/transfer.
  repositoryId: z.string().min(1).max(64),
  ownerRepo: z.string().min(1).max(256),
  branch: z.string().min(1).max(256),
  commit: z.string().min(1).max(64),
  url: z.string().min(1).max(2048),
  report: z.unknown(),
})

export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  const auth = request.headers.get('authorization') ?? ''
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (raw.length === 0) {
    return NextResponse.json({ error: 'missing_api_key' }, { status: 401 })
  }
  const key = await verifyApiKey(raw)
  if (key === null) {
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 })
  }
  if (!isPaidPlan(key.plan)) {
    return NextResponse.json(
      { error: 'premium_required', upgrade: 'https://isready.ai/#pricing' },
      { status: 403 },
    )
  }
  const ownerUserId = await apiKeyOwnerId(key)
  if (ownerUserId === null) {
    return NextResponse.json({ error: 'no_persistence' }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const report = parsed.data.report
  if (!isScanReport(report) && !isSiteReport(report)) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 })
  }

  let result: Awaited<ReturnType<typeof persistCiReport>>
  try {
    result = await persistCiReport({
      repositoryId: parsed.data.repositoryId,
      ownerRepo: parsed.data.ownerRepo,
      branch: parsed.data.branch,
      commit: parsed.data.commit,
      url: parsed.data.url,
      report,
      apiKeyId: key.id,
      ownerUserId,
    })
  } catch (error) {
    if (error instanceof CiRepoTakeoverError) {
      return NextResponse.json({ error: 'repo_owned_by_other_account' }, { status: 403 })
    }
    throw error
  }
  if (result === null) {
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isready.ai'
  const badgeUrl = `${origin}/badge/gh/${result.slug}/${encodeURIComponent(result.branch)}`
  const reportUrl = `${origin}/report/gh/${result.slug}/${encodeURIComponent(result.commit)}`
  const badgeMarkdown = `[![AI readiness](${badgeUrl})](${reportUrl})`

  return NextResponse.json({
    slug: result.slug,
    branch: result.branch,
    commit: result.commit,
    score: result.score,
    grade: result.grade,
    linkedWebsite: result.linkedWebsite,
    badgeUrl,
    reportUrl,
    badgeMarkdown,
  })
}
