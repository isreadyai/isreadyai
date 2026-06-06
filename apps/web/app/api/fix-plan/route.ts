import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isScanReport } from '@isreadyai/scanner'
import { consumeMeteredRun, planQuota, refundMeteredRun, verifyApiKey } from '@/lib/api-keys'
import { isPaidPlan } from '@/lib/plans'
import { fixPlanConfigured, generateAiFixPlan } from '@/lib/fix-plan-ai'

// MARK: - POST /api/fix-plan — AI-generated, stack-tailored remediation plan
//
// The premium AI upgrade over POST /api/fix's deterministic plan: takes a scan
// report, returns a tailored Markdown plan written through the funded AI
// Gateway. Bearer API key (Pro/Team), metered against the plan's 30-day quota.
// The GitHub fix Action calls this to enrich its pull request.

export const maxDuration = 60

const BodySchema = z.object({
  repo: z.string().min(1).max(256).optional(),
  report: z.unknown(),
})

export async function POST(request: Request): Promise<NextResponse> {
  if (!fixPlanConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
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

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isScanReport(parsed.data.report)) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 })
  }

  // Reserve the run atomically BEFORE the funded AI call; refund it if generation
  // fails, so a failed plan never counts against the quota.
  const runId = await consumeMeteredRun(key, {
    kind: 'plan',
    repo: parsed.data.repo ?? 'unknown',
    url: parsed.data.report.finalUrl,
    patches: 0,
  })
  if (runId === null) {
    const quota = await planQuota(key)
    return NextResponse.json(
      { error: 'quota_exceeded', quota, upgrade: 'https://isready.ai/#pricing' },
      { status: 429 },
    )
  }

  const plan = await generateAiFixPlan(parsed.data.report)
  if (plan === null) {
    await refundMeteredRun(runId)
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 })
  }

  const quota = await planQuota(key)
  return NextResponse.json({ plan, quota: { used: quota.used, limit: quota.limit } })
}
