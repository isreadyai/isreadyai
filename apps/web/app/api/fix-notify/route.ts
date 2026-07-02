import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@isreadyai/supabase'
import { consumeRateLimit } from '@/lib/rate-limit'
import { apiKeyOwnerId, verifyApiKey } from '@/lib/api-keys'
import { sendFixPrEmail } from '@/lib/email-fix'
import { isPaidPlan } from '@/lib/plans'

// MARK: - POST /api/fix-notify

export const maxDuration = 15

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

// owner/repo, GitHub's own slug charset (no leading/trailing slash, one slash).
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
// /{owner}/{repo}/pull/{positive integer}, same slug charset, no leading zero.
const PR_PATH_RE = /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/

const BodySchema = z.object({
  repo: z.string().max(256).regex(REPO_RE),
  prUrl: z.string().url(),
  patches: z.number().int().nonnegative(),
})

type TFixNotify = z.infer<typeof BodySchema>

/**
 * True for a canonical https://github.com/{owner}/{repo}/pull/{id} URL only —
 * that link goes into an email, so anything else (a non-github host,
 * credentials, a non-default port, a query/fragment, or a non-PR path) is
 * rejected.
 */
function isCanonicalPrUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.host === 'github.com' &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === '' &&
    PR_PATH_RE.test(url.pathname)
  )
}

/** Validates the notify payload. Exported for testing. */
export function parseFixNotify(raw: unknown): { ok: true; data: TFixNotify } | { ok: false } {
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success || !isCanonicalPrUrl(parsed.data.prUrl)) {
    return { ok: false }
  }
  return { ok: true, data: parsed.data }
}

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
  if (!isPaidPlan(key.plan)) {
    return NextResponse.json(
      { error: 'premium_required', upgrade: 'https://isready.ai/#pricing' },
      { status: 403 },
    )
  }
  if (!(await consumeRateLimit(key.id, RATE_WINDOW_MS, RATE_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = parseFixNotify(await request.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // Recipient is the API-key owner, resolved server-side — never an address from
  // the request — so the notification can only ever reach the account owner.
  const userId = await apiKeyOwnerId(key)
  if (userId === null) {
    return NextResponse.json({ sent: false })
  }
  const service = await createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  const email = profile?.email
  if (typeof email !== 'string' || email.length === 0) {
    return NextResponse.json({ sent: false })
  }

  const sent = await sendFixPrEmail(email, parsed.data)
  return NextResponse.json({ sent })
}
