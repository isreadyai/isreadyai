import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { signScanWriteToken } from '@/lib/scan-write-token'

process.env.PROXY_TOKEN_SECRET = 'scan-test-secret'

// MARK: - Scan [id] route ownership tests
//
// The store, session client and workspace membership are mocked at the factory
// boundary so the IDOR gates can be exercised without a live database. RLS is
// enforced in Postgres and covered separately by the migration tests.

type TScanOwner = { userId: string | null; workspaceId: string | null }

let owner: TScanOwner | null
let record: unknown
let sessionUser: { id: string } | null
let memberRole: string | null
let lastUpdate: unknown

const VALID_ID = '11111111-1111-4111-8111-111111111111'

const SCAN_REPORT = {
  url: 'https://example.com',
  scoreVersion: '1',
  overall: 90,
  grade: 'excellent',
  categories: [],
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: '2026-01-01T00:00:01.000Z',
  finalUrl: 'https://example.com/',
  checks: [],
  meta: { durationMs: 1, fetchOk: true },
}

const SITE_REPORT = {
  url: 'https://example.com',
  scoreVersion: '1',
  overall: 90,
  grade: 'excellent',
  categories: [],
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: '2026-01-01T00:00:01.000Z',
  finalUrl: 'https://example.com/',
  discovered: 1,
  primary: SCAN_REPORT,
  pages: [SCAN_REPORT],
}

const realStore = await import('@/lib/scan-store.ts')
const realServer = await import('@/lib/supabase/server.ts')
const realWorkspace = await import('@/lib/workspace.ts')

mock.module('@/lib/scan-store.ts', () => ({
  ...realStore,
  getScanStore: () =>
    Promise.resolve({
      getOwner: () => Promise.resolve(owner),
      get: () => Promise.resolve(record),
      update: (_id: string, patch: unknown) => {
        lastUpdate = patch
        return Promise.resolve()
      },
    }),
}))

mock.module('@/lib/supabase/server.ts', () => ({
  ...realServer,
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: sessionUser } }) },
    }),
}))

mock.module('@/lib/workspace.ts', () => ({
  ...realWorkspace,
  getMemberRole: () => Promise.resolve(memberRole),
}))

const { GET, PATCH } = await import('./route')

function patchRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://isready.ai/api/scan/${VALID_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

afterAll(() => {
  mock.module('@/lib/scan-store.ts', () => realStore)
  mock.module('@/lib/supabase/server.ts', () => realServer)
  mock.module('@/lib/workspace.ts', () => realWorkspace)
})

beforeEach(() => {
  owner = null
  record = null
  sessionUser = null
  memberRole = null
  lastUpdate = undefined
})

describe('GET /api/scan/[id] is public-by-id', () => {
  test('rejects an invalid id with 400', async () => {
    const response = await GET(new Request('https://isready.ai/api/scan/not-a-uuid'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })
    expect(response.status).toBe(400)
  })

  test('anonymous scan is readable without a session', async () => {
    record = { id: VALID_ID, status: 'done' }

    const response = await GET(new Request(`https://isready.ai/api/scan/${VALID_ID}`), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: VALID_ID, status: 'done' })
  })

  test('owned scan is readable by anyone with the id (shareable link)', async () => {
    record = { id: VALID_ID, status: 'done' }

    const response = await GET(new Request(`https://isready.ai/api/scan/${VALID_ID}`), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: VALID_ID, status: 'done' })
  })

  test('workspace scan is readable by anyone with the id', async () => {
    record = { id: VALID_ID, status: 'done' }

    const response = await GET(new Request(`https://isready.ai/api/scan/${VALID_ID}`), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(200)
  })

  test('missing scan returns 404', async () => {
    record = null

    const response = await GET(new Request(`https://isready.ai/api/scan/${VALID_ID}`), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(404)
  })
})

describe('PATCH /api/scan/[id] ownership', () => {
  test('rejects an owned scan without a session', async () => {
    owner = { userId: 'owner-1', workspaceId: null }
    record = { id: VALID_ID, report: SCAN_REPORT }

    const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(401)
    expect(lastUpdate).toBeUndefined()
  })

  test('rejects an owned scan for a non-owner session', async () => {
    owner = { userId: 'owner-1', workspaceId: null }
    sessionUser = { id: 'attacker' }
    record = { id: VALID_ID, report: SCAN_REPORT }

    const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(404)
    expect(lastUpdate).toBeUndefined()
  })

  test('writes an anonymous scan with a valid write token and matching host', async () => {
    owner = { userId: null, workspaceId: null }
    record = { id: VALID_ID, report: SCAN_REPORT }

    const response = await PATCH(
      patchRequest(
        { siteReport: SITE_REPORT },
        { 'x-scan-write-token': signScanWriteToken(VALID_ID) },
      ),
      { params: Promise.resolve({ id: VALID_ID }) },
    )

    expect(response.status).toBe(200)
    expect(lastUpdate).toEqual({ siteReport: SITE_REPORT })
  })

  test('rejects an anonymous write without a valid write token', async () => {
    owner = { userId: null, workspaceId: null }
    record = { id: VALID_ID, report: SCAN_REPORT }

    const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(401)
    expect(lastUpdate).toBeUndefined()
  })

  test('writes an owned scan for its owner', async () => {
    owner = { userId: 'owner-1', workspaceId: null }
    sessionUser = { id: 'owner-1' }
    record = { id: VALID_ID, report: SCAN_REPORT }

    const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(200)
    expect(lastUpdate).toEqual({ siteReport: SITE_REPORT })
  })

  test('rejects a host mismatch even for the owner', async () => {
    owner = { userId: 'owner-1', workspaceId: null }
    sessionUser = { id: 'owner-1' }
    record = { id: VALID_ID, report: { ...SCAN_REPORT, finalUrl: 'https://other.com/' } }

    const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(400)
    expect(lastUpdate).toBeUndefined()
  })

  // M2: only a manager (owner/admin) may overwrite a workspace teammate's report;
  // a plain member / viewer / billing member is a non-owner → clean 404.
  for (const role of ['member', 'viewer', 'billing']) {
    test(`rejects a workspace scan for a non-manager ${role}`, async () => {
      owner = { userId: null, workspaceId: 'ws-1' }
      sessionUser = { id: `${role}-1` }
      memberRole = role
      record = { id: VALID_ID, report: SCAN_REPORT }

      const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
        params: Promise.resolve({ id: VALID_ID }),
      })

      expect(response.status).toBe(404)
      expect(lastUpdate).toBeUndefined()
    })
  }

  for (const role of ['owner', 'admin']) {
    test(`writes a workspace scan for a manager ${role}`, async () => {
      owner = { userId: null, workspaceId: 'ws-1' }
      sessionUser = { id: `${role}-1` }
      memberRole = role
      record = { id: VALID_ID, report: SCAN_REPORT }

      const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
        params: Promise.resolve({ id: VALID_ID }),
      })

      expect(response.status).toBe(200)
      expect(lastUpdate).toEqual({ siteReport: SITE_REPORT })
    })
  }

  test('rejects an oversized streamed body with no Content-Length (M5)', async () => {
    record = { id: VALID_ID, report: SCAN_REPORT }
    // A single chunk just over MAX_BODY_BYTES (4_000_000) with no Content-Length
    // header: the running-total cap must reject it before it reaches request.json().
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4_000_001))
        controller.close()
      },
    })
    const request = new Request(`https://isready.ai/api/scan/${VALID_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_ID }) })

    expect(response.status).toBe(413)
    expect(lastUpdate).toBeUndefined()
  })
})
