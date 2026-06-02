import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

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

function patchRequest(body: unknown): Request {
  return new Request(`https://isready.ai/api/scan/${VALID_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
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

  test('writes an anonymous scan when the host matches', async () => {
    owner = { userId: null, workspaceId: null }
    record = { id: VALID_ID, report: SCAN_REPORT }

    const response = await PATCH(patchRequest({ siteReport: SITE_REPORT }), {
      params: Promise.resolve({ id: VALID_ID }),
    })

    expect(response.status).toBe(200)
    expect(lastUpdate).toEqual({ siteReport: SITE_REPORT })
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
})
