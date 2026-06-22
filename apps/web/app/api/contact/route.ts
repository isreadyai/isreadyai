import { NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeRateLimit } from '@/lib/rate-limit'
import { createContactTask, isClickUpConfigured } from '@/lib/clickup'
import { verifyTurnstile } from '@/lib/turnstile-verify'

// MARK: - POST /api/contact — contact / feedback / fraudulent-domain report
//
// Creates a ClickUp task per submission (the team's CRM). Guarded by a per-IP
// and a global rate limit plus a Turnstile check, since it's a public form. 503
// when ClickUp isn't configured — the UI then shows a friendly fallback.

export const maxDuration = 15

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000
const GLOBAL_LIMIT = 100

const BodySchema = z.object({
  reason: z.enum(['feedback', 'bug', 'fraud', 'other']),
  email: z.email().max(254),
  name: z.string().max(120).optional(),
  host: z.string().max(253).optional(),
  message: z.string().min(10).max(5000),
  turnstileToken: z.string().max(4096).optional(),
})

/** Trusted client IP: platform `x-real-ip`, else the rightmost `x-forwarded-for` hop. */
function clientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp !== undefined && realIp !== '') {
    return realIp
  }
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded !== null) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter((hop) => hop !== '')
    const trusted = hops[hops.length - 1]
    if (trusted !== undefined) {
      return trusted
    }
  }
  return 'local'
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isClickUpConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const ip = clientIp(request)
  const [perIpAllowed, globalAllowed] = await Promise.all([
    consumeRateLimit(`contact:${ip}`, RATE_WINDOW_MS, RATE_LIMIT),
    consumeRateLimit('contact:global', RATE_WINDOW_MS, GLOBAL_LIMIT),
  ])
  if (!perIpAllowed || !globalAllowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!(await verifyTurnstile(parsed.data.turnstileToken ?? '', ip))) {
    return NextResponse.json({ error: 'captcha_failed' }, { status: 403 })
  }

  const created = await createContactTask({
    reason: parsed.data.reason,
    email: parsed.data.email,
    name: parsed.data.name,
    host: parsed.data.host,
    message: parsed.data.message,
  })
  if (!created) {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
