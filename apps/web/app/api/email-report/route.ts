import { NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getScanStore } from '@/lib/scan-store'
import { emailConfigured, saveLead, sendReportEmail } from '@/lib/email-report'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMemberRole } from '@/lib/workspace'

// MARK: - POST /api/email-report

/**
 * Email-gated delivery: validates the scan, captures the lead, sends the PDF +
 * Markdown via Resend. Anonymous (public-by-id) scans keep the lead-capture UX;
 * owned scans are private — a scan owned by EITHER a user or a workspace may only
 * be emailed by that user or an active member of that workspace, so an attacker
 * can't enumerate ids to relay reports to arbitrary addresses. Both a per-IP and a
 * global cap bound Resend cost/reputation. 503 when no email provider is
 * configured — the UI then degrades to direct downloads.
 */

export const maxDuration = 30

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000
// Bounds total Resend spend even under a distributed (many-IP) abuse attempt.
const GLOBAL_LIMIT = 200

const BodySchema = z.object({
  id: z.uuid(),
  email: z.email().max(254),
})

/**
 * Trusted client IP. `x-real-ip` is platform-set and unspoofable; the
 * `x-forwarded-for` fallback takes the RIGHTMOST hop (our proxy), since leftmost
 * entries are caller-supplied. Local dev shares the single 'local' bucket.
 */
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

/**
 * Whether the caller may email an OWNED scan: its owning user, or an active
 * member of its owning workspace. Fails closed on any auth error.
 */
async function canEmailOwnedScan(owner: {
  userId: string | null
  workspaceId: string | null
}): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user === null) {
      return false
    }
    if (owner.userId !== null && owner.userId === user.id) {
      return true
    }
    return (
      owner.workspaceId !== null &&
      (await getMemberRole(supabase, user.id, owner.workspaceId)) !== null
    )
  } catch {
    return false
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!emailConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const [perIpAllowed, globalAllowed] = await Promise.all([
    consumeRateLimit(clientIp(request), RATE_WINDOW_MS, RATE_LIMIT),
    consumeRateLimit('email-report:global', RATE_WINDOW_MS, GLOBAL_LIMIT),
  ])
  if (!perIpAllowed || !globalAllowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const store = await getScanStore()
  const record = await store.get(parsed.data.id)
  if (record === null || record.status !== 'done' || record.report === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Owned (private) scans must not be relayed to arbitrary addresses. A scan is
  // owned when it has either an owning user or an owning workspace; only that user
  // or a workspace member may email it. Anonymous scans stay lead-capturable.
  const owner = await store.getOwner(parsed.data.id)
  if (
    owner !== null &&
    (owner.userId !== null || owner.workspaceId !== null) &&
    !(await canEmailOwnedScan(owner))
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Lead first: the intent is captured even if the provider hiccups.
  await saveLead(parsed.data.email, record.id)

  const sent = await sendReportEmail(parsed.data.email, record.report, record.id)
  if (!sent) {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
