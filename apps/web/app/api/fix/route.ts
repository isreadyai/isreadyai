import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildFixPlan, isScanReport } from '@isreadyai/scanner'
import { consumeMeteredRun, fixQuota, setMeteredRunPatches, verifyApiKey } from '@/lib/api-keys'

// MARK: - POST /api/fix

/**
 * Metered endpoint behind the fix-action: takes a scan report + the repo's
 * robots/llms files, returns patches + a markdown plan. Bearer API key
 * required; each run counts against the plan's rolling 30-day quota.
 */

export const maxDuration = 60

const FileSchema = z.object({
  path: z.string().min(1).max(256),
  content: z.string().max(64_000),
})

const BodySchema = z.object({
  repo: z.string().min(3).max(256),
  report: z.unknown(),
  files: z
    .object({
      robots: FileSchema.optional(),
      llms: FileSchema.optional(),
    })
    .default({}),
})

export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization') ?? ''
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (raw.length === 0) {
    return NextResponse.json({ error: 'missing_api_key' }, { status: 401 })
  }
  const key = await verifyApiKey(raw)
  if (key === null) {
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!isScanReport(parsed.data.report)) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 })
  }

  // Atomically reserve the run before doing the work — no check-then-record race.
  const runId = await consumeMeteredRun(key, {
    kind: 'fix',
    repo: parsed.data.repo,
    url: parsed.data.report.finalUrl,
    patches: 0,
  })
  if (runId === null) {
    const quota = await fixQuota(key)
    return NextResponse.json(
      { error: 'quota_exceeded', quota, upgrade: 'https://isready.ai/#pricing' },
      { status: 429 },
    )
  }

  const plan = buildFixPlan(parsed.data.report, parsed.data.files)
  await setMeteredRunPatches(runId, plan.patches.length)

  const quota = await fixQuota(key)
  return NextResponse.json({
    patches: plan.patches,
    markdown: plan.markdown,
    quota: { used: quota.used, limit: quota.limit },
  })
}
