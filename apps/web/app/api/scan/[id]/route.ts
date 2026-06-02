import { NextResponse } from 'next/server'
import { hostOf, isSiteReport } from '@isreadyai/scanner'
import { getScanStore } from '@/lib/scan-store'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMemberRole, isWorkspaceManager } from '@/lib/workspace'

const ID_RE = /^[0-9a-f-]{36}$/i
// Compressed body cap — applied to the content-length (gzip or raw).
const MAX_BODY_BYTES = 4_000_000
// Decompressed cap: well above a legit ~50 MB report, well below a GB zip-bomb.
const MAX_DECOMPRESSED_BYTES = 64_000_000

type TScanOwner = { userId: string | null; workspaceId: string | null }

/**
 * Gates access to an owned scan. Anonymous scans (both owner fields null) are
 * public-by-id and never reach here. For an owned scan we require a session that
 * either is the owning user or is an active member of the owning workspace.
 * Returns an error response to send, or null when access is granted.
 */
async function denyUnlessOwner(owner: TScanOwner): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (owner.userId !== null && owner.userId === user.id) {
    return null
  }
  if (
    owner.workspaceId !== null &&
    (await getMemberRole(supabase, user.id, owner.workspaceId)) !== null
  ) {
    return null
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 })
}

function isOwned(owner: TScanOwner): boolean {
  return owner.userId !== null || owner.workspaceId !== null
}

// MARK: - GET /api/scan/[id]

/**
 * Reports are public-by-id: the unguessable UUID is the capability, so anyone
 * with the link can read the report (this is what "Share report" hands out).
 * The payload carries no PII or owner identity — only the public site's audit.
 * Mutations (PATCH/DELETE) stay strictly owner-gated below.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const store = await getScanStore()
  const record = await store.get(id)
  if (record === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(record)
}

// MARK: - PATCH /api/scan/[id] — persist the free in-browser deep scan

/**
 * The deep scan runs client-side; this lets the browser write the resulting
 * ISiteReport back onto its own scan row so /report/<id>?deep=true survives
 * reload and is shareable. The host must match the original scan to stop a
 * deep report from being grafted onto an unrelated id.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  const isGzip = request.headers.get('x-content-encoding') === 'gzip'

  let body: unknown
  try {
    if (isGzip) {
      // Client compressed the JSON with CompressionStream('gzip') to fit under the
      // body cap; decompress before parsing.
      const rawBytes = new Uint8Array(await request.arrayBuffer())
      // Blob.stream().pipeThrough() drives the writable side concurrently as we
      // drain the readable — no backpressure deadlock (same fix as client-side).
      // The running-total cap still aborts a zip-bomb mid-stream.
      const reader = new Blob([rawBytes])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'))
        .getReader()
      const chunks: Uint8Array[] = []
      let totalBytes = 0
      while (true) {
        const result = await reader.read()
        if (result.done) break
        totalBytes += result.value.byteLength
        if (totalBytes > MAX_DECOMPRESSED_BYTES) {
          void reader.cancel().catch(() => undefined)
          return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
        }
        chunks.push(result.value)
      }
      const merged = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
      }
      const decompressedText = new TextDecoder().decode(merged)
      body = JSON.parse(decompressedText)
    } else {
      body = await request.json()
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const siteReport = (body as { siteReport?: unknown } | null)?.siteReport
  if (!isSiteReport(siteReport)) {
    return NextResponse.json({ error: 'invalid_site_report' }, { status: 400 })
  }

  const store = await getScanStore()
  const owner = await store.getOwner(id)
  if (owner === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (isOwned(owner)) {
    const denied = await denyUnlessOwner(owner)
    if (denied !== null) {
      return denied
    }
  }

  const record = await store.get(id)
  if (record === null || record.report === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (hostOf(siteReport.primary.finalUrl) !== hostOf(record.report.finalUrl)) {
    return NextResponse.json({ error: 'host_mismatch' }, { status: 400 })
  }

  await store.update(id, { siteReport })
  return NextResponse.json({ ok: true })
}

// MARK: - DELETE /api/scan/[id] — owner removes their own saved scan

/**
 * Authenticated, ownership-checked deletion. Deleting is destructive, so it's
 * allowed for the scan's own user OR a manager (owner/admin) of the owning
 * workspace — a plain member can view and PATCH a teammate's scan but not delete
 * it. Returns a clean 404 (never leaks existence) when unauthorized.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const store = await getScanStore()
  const owner = await store.getOwner(id)
  if (owner === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const isOwnScan = owner.userId !== null && owner.userId === user.id
  const isManager =
    owner.workspaceId !== null &&
    isWorkspaceManager(await getMemberRole(supabase, user.id, owner.workspaceId))
  if (!isOwnScan && !isManager) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  await store.delete(id)
  return NextResponse.json({ ok: true })
}
