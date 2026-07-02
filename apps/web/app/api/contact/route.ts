import { NextResponse } from 'next/server'
import { z } from 'zod'
import { clientIp } from '@/lib/client-ip'
import { consumeRateLimit } from '@/lib/rate-limit'
import { createContactTask, postContactMessage, isClickUpConfigured } from '@/lib/clickup'
import { verifyTurnstile } from '@/lib/turnstile-verify'

// MARK: - POST /api/contact — contact / feedback / fraudulent-domain report
//
// Per submission: creates a ClickUp task (the durable record) AND posts a
// Markdown message to the isready.ai Chat channel for visibility. Guarded by a
// per-IP and a global rate limit plus a Turnstile check, since it's a public
// form. 503 when ClickUp isn't configured — the UI then shows a friendly fallback.

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

export async function POST(request: Request): Promise<NextResponse> {
  if (!isClickUpConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  // Cheap per-IP gate first; the shared GLOBAL bucket is consumed only after a
  // valid captcha (below), so unsolved requests can't drain it and DoS everyone.
  const ip = clientIp(request)
  if (!(await consumeRateLimit(`contact:${ip}`, RATE_WINDOW_MS, RATE_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!(await verifyTurnstile(parsed.data.turnstileToken ?? '', ip))) {
    return NextResponse.json({ error: 'captcha_failed' }, { status: 403 })
  }

  if (!(await consumeRateLimit('contact:global', RATE_WINDOW_MS, GLOBAL_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const submission = {
    reason: parsed.data.reason,
    email: parsed.data.email,
    name: parsed.data.name,
    host: parsed.data.host,
    message: parsed.data.message,
  }
  // Task is the durable record (gates success); the channel message is additive
  // and best-effort. Run both concurrently to stay within maxDuration.
  const [created] = await Promise.all([
    createContactTask(submission),
    postContactMessage(submission),
  ])
  if (!created) {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
