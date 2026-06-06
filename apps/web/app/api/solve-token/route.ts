import { NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeRateLimit } from '@/lib/rate-limit'
import { consumeMeteredRun, solveQuota, verifyApiKey } from '@/lib/api-keys'
import { isPaidPlan } from '@/lib/plans'
import { signSolveToken, solveSecret } from '@/lib/solve-token'

// MARK: - POST /api/solve-token

/**
 * Mints a short-lived, inference-scoped, model-pinned, call-budgeted token for
 * the premium fix action. The agent runs in the runner; this token only lets it
 * reach isready.ai's inference proxy — never the real gateway key. Premium-gated
 * and metered (one fix_runs row per mint). The model is env-driven (SOLVE_MODEL,
 * falling back to Opus).
 */

export const maxDuration = 15

const TOKEN_TTL_SECONDS = 15 * 60
const MAX_CALLS = 40
const FALLBACK_MODEL = 'anthropic/claude-opus-4.8'

const RATE_LIMIT = 6
const RATE_WINDOW_MS = 60_000

const BodySchema = z.object({
  repo: z.string().min(1).max(256).optional(),
})

function solveModel(): string {
  const model = process.env.SOLVE_MODEL
  return model !== undefined && model.length > 0 ? model : FALLBACK_MODEL
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = solveSecret()
  if (secret === null) {
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
  if (!(await consumeRateLimit(key.id, RATE_WINDOW_MS, RATE_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  const repo = parsed.success ? (parsed.data.repo ?? 'unknown') : 'unknown'

  const runId = crypto.randomUUID()
  // Reserve the run atomically (the token mint is the billed unit) before signing.
  const reserved = await consumeMeteredRun(key, {
    kind: 'solve',
    repo,
    url: `solve:${runId}`,
    patches: 0,
  })
  if (reserved === null) {
    const quota = await solveQuota(key)
    return NextResponse.json(
      { error: 'quota_exceeded', quota, upgrade: 'https://isready.ai/#pricing' },
      { status: 429 },
    )
  }

  const iat = Math.floor(Date.now() / 1000)
  const model = solveModel()
  const token = await signSolveToken(
    {
      sub: key.id,
      scope: 'inference',
      model,
      jti: runId,
      calls: MAX_CALLS,
      iat,
      exp: iat + TOKEN_TTL_SECONDS,
    },
    secret,
  )

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isready.ai'
  return NextResponse.json({
    token,
    baseUrl: `${origin}/api/solve-inference`,
    model,
    calls: MAX_CALLS,
    expiresAt: (iat + TOKEN_TTL_SECONDS) * 1000,
  })
}
