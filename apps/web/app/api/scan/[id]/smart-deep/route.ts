import { NextResponse } from 'next/server'
import type { ISmartAgentSiteReport } from '@isreadyai/scanner'
import { consumeRateLimit } from '@/lib/rate-limit'
import { apiKeyOwnerId, verifyApiKey } from '@/lib/api-keys'
import { isPaidPlan } from '@/lib/plans'
import { getScanStore } from '@/lib/scan-store'
import {
  runWebSmartDeepAudit,
  runWebSmartDeepAuditFromUrls,
} from '@/lib/smart-agent/run-smart-deep'
import { resolveWorkspaceContext } from '@/lib/workspace-context'

// Each page is a real headless-browser session, so allow a long budget.
export const maxDuration = 300

const ID_RE = /^[0-9a-f-]{36}$/i
// Each pass is a multi-page headless run; keep the per-key budget tight.
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 5

/**
 * Authorizes a deep pass for the caller's scope. A scan is in scope when it is
 * anonymous (public-by-id, ownerUserId === null), owned by the caller, or owned
 * by the caller's active workspace (so a team member can run it on a teammate's
 * scan — mirrors the dashboard scan-detail page's ownership check). Returns false
 * for everyone else.
 */
export function isScanAuthorized(
  owner: { userId: string | null; workspaceId?: string | null } | null,
  callerUserId: string | null,
  callerWorkspaceId: string | null = null,
): boolean {
  if (owner === null) {
    return false
  }
  if (owner.userId === null) {
    return true
  }
  if (owner.userId === callerUserId) {
    return true
  }
  const ownerWorkspaceId = owner.workspaceId ?? null
  return ownerWorkspaceId !== null && ownerWorkspaceId === callerWorkspaceId
}

type TAccess =
  | { ok: false }
  | { ok: true; ownerUserId: string | null; callerWorkspaceId: string | null; rateKey: string }

// MARK: - POST /api/scan/[id]/smart-deep — premium deep Smart Agent pass

/**
 * Premium, server-side, capped: runs the browser-capable audit across the
 * deep-scan pages and stores the aggregated site-wide Smart Agent report. The
 * in-app caller sends its crawled page URLs in the body so the pass no longer
 * depends on a slow/missing siteReport persist; URL-less callers (API key/CLI)
 * fall back to the persisted siteReport. Same-host validated (anti-SSRF), scoped
 * to the caller's (or anonymous) scans, per-key rate-limited. Idempotent.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const access = await resolveAccess(request)
  if (!access.ok) {
    return NextResponse.json({ error: 'premium_required' }, { status: 403 })
  }
  if (!(await consumeRateLimit(access.rateKey, RATE_WINDOW_MS, RATE_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const pageUrls = await parsePageUrls(request)

  const store = await getScanStore()
  const record = await store.get(id)
  if (record === null) {
    return NextResponse.json({ error: 'deep_scan_required' }, { status: 404 })
  }
  const owner = await store.getOwner(id)
  if (!isScanAuthorized(owner, access.ownerUserId, access.callerWorkspaceId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (record.siteSmartReport !== null) {
    return NextResponse.json(record.siteSmartReport)
  }

  // Prefer the client's own crawled pages (same-host only — the SSRF guard) so a
  // slow/missing siteReport persist no longer blocks the pass; fall back to the
  // persisted crawl when no usable URLs were sent (API-key/CLI callers).
  const clientUrls = sameHostUrls(pageUrls, record.url)

  try {
    let result: ISmartAgentSiteReport
    if (clientUrls.length > 0) {
      result = await runWebSmartDeepAuditFromUrls(clientUrls)
    } else if (record.siteReport !== null) {
      result = await runWebSmartDeepAudit(record.siteReport)
    } else {
      return NextResponse.json({ error: 'deep_scan_required' }, { status: 404 })
    }
    await store.update(id, { siteSmartReport: result })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'smart_deep_failed', message }, { status: 502 })
  }
}

async function resolveAccess(request: Request): Promise<TAccess> {
  // Paid API key (CLI/CI): the metered owner, scoped to its own (or anonymous) scans.
  const authorization = request.headers.get('authorization')
  const rawKey = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (rawKey.length > 0) {
    const key = await verifyApiKey(rawKey)
    if (key !== null && isPaidPlan(key.plan)) {
      return {
        ok: true,
        ownerUserId: await apiKeyOwnerId(key),
        callerWorkspaceId: null,
        rateKey: `key:${key.id}`,
      }
    }
  }
  // Signed-in user on a paid EFFECTIVE plan (the active workspace owner's, so team
  // members inherit it) — the in-app deep pass. Scoped to their own scans and to
  // any scan owned by their active workspace; there is no anonymous bypass.
  try {
    const ctx = await resolveWorkspaceContext()
    if (ctx !== null && isPaidPlan(ctx.ownerPlan)) {
      return {
        ok: true,
        ownerUserId: ctx.userId,
        callerWorkspaceId: ctx.workspaceId,
        rateKey: `user:${ctx.userId}`,
      }
    }
  } catch {
    return { ok: false }
  }
  return { ok: false }
}

/** Pulls the optional client-supplied page URLs from the JSON body; [] for none. */
async function parsePageUrls(request: Request): Promise<string[]> {
  try {
    const body = (await request.json()) as { pageUrls?: unknown }
    if (!Array.isArray(body.pageUrls)) {
      return []
    }
    return body.pageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
  } catch {
    return []
  }
}

/** Host without a leading www., lowercased; null for a non-http(s) or unparseable URL. */
function normalizedHost(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    const host = parsed.hostname.toLowerCase()
    return host.startsWith('www.') ? host.slice(4) : host
  } catch {
    return null
  }
}

/**
 * The SSRF guard: keeps only client URLs whose host matches the scanned site's
 * own host (apex/www treated as the same site, http(s) only). The headless
 * browser must never be pointed at an arbitrary host the caller injects.
 */
function sameHostUrls(urls: string[], scanUrl: string): string[] {
  const scanHost = normalizedHost(scanUrl)
  if (scanHost === null) {
    return []
  }
  const seen = new Set<string>()
  const kept: string[] = []
  for (const url of urls) {
    if (normalizedHost(url) === scanHost && !seen.has(url)) {
      seen.add(url)
      kept.push(url)
    }
  }
  return kept
}
