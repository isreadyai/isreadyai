import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { z } from 'zod'
import { validateScanInput } from '@isreadyai/scanner'
import { getScanStore } from '@/lib/scan-store'
import { runScan } from '@/lib/run-scan'
import { smartAgentEnabledForScan } from '@/lib/smart-agent/smart-pref'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveWorkspaceId } from '@/lib/workspace'
import { signScanWriteToken } from '@/lib/scan-write-token'
import { clientIp } from '@/lib/client-ip'

// MARK: - POST /api/scan

/**
 * Creates a scan job and runs it after the response is sent (fluid compute
 * keeps the function alive). The client polls GET /api/scan/[id].
 */

export const maxDuration = 300

const BodySchema = z.object({
  url: z.string().min(3).max(2048),
})

// Limits live in the scan store: per-IP-hash rows in Postgres with Supabase,
// per-instance memory otherwise. Only a SHA-256 of the IP is stored. With no
// trusted IP header (local dev) every request shares one bucket.
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: Request): Promise<NextResponse> {
  const ipHash = await hashIp(clientIp(request))

  const store = await getScanStore()
  let recentCount: number
  try {
    recentCount = await store.recentCountByIp(ipHash, RATE_WINDOW_MS)
  } catch {
    // Fail closed: if the limiter can't be consulted we refuse rather than
    // expose unbounded 300s headless-browser scans to abuse.
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  if (recentCount >= RATE_LIMIT) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Single source of truth, shared with the client form (packages/scanner).
  const validated = validateScanInput(parsed.data.url)
  if (!validated.ok) {
    return NextResponse.json({ error: `invalid_url:${validated.problem}` }, { status: 400 })
  }

  // Attribute the scan to the signed-in account AND its active workspace so it
  // shows under the right account; anonymous runs stay user-less and
  // workspace-less. Auth failures must not block scanning.
  let userId: string | null = null
  let workspaceId: string | null = null
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
    if (userId !== null) {
      workspaceId = await getActiveWorkspaceId(supabase, userId)
    }
  } catch {
    userId = null
    workspaceId = null
  }

  const record = await store.create(validated.url, ipHash, userId, 'web', workspaceId)

  const smart = await smartAgentEnabledForScan(validated.url)
  after(() => runScan(record.id, { smart }))

  // No proxyToken here: the deep-scan relay token is issued server-side by the
  // report page (scoped to that view), so this anonymous endpoint never hands one
  // out — closing the open-relay-token vector.
  return NextResponse.json(
    { id: record.id, status: record.status, writeToken: signScanWriteToken(record.id) },
    { status: 202 },
  )
}
