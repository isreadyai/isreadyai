import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

// MARK: - POST /api/scan rate-limiter + client-IP tests
//
// The scan store, session client, scan runner and smart-pref are mocked at the
// factory boundary so the rate-limiting and IP-derivation branches can be
// exercised without a live database or a real headless-browser scan. `after`
// from next/server is stubbed to a no-op so the deferred runScan never fires.

let recentCount: number
let throwOnCount: boolean
let capturedIpHash: string | null
let created: { url: string; ipHash: string | null; userId: string | null; source?: string } | null

// Hermetic: the production scan path signs a proxy token, which needs this secret.
// Set a deterministic test value so a clean checkout / CI (no local .env) runs the
// same code path instead of throwing. Restored in afterAll.
const realProxyTokenSecret = process.env.PROXY_TOKEN_SECRET
process.env.PROXY_TOKEN_SECRET = 'test-proxy-token-secret'

const realStore = await import('@/lib/scan-store.ts')
const realServer = await import('@/lib/supabase/server.ts')
const realRunScan = await import('@/lib/run-scan.ts')
const realSmartPref = await import('@/lib/smart-agent/smart-pref.ts')
const realNextServer = await import('next/server')

mock.module('@/lib/scan-store.ts', () => ({
  ...realStore,
  getScanStore: () =>
    Promise.resolve({
      recentCountByIp: (ipHash: string) => {
        capturedIpHash = ipHash
        if (throwOnCount) {
          return Promise.reject(new Error('rate-limit count failed'))
        }
        return Promise.resolve(recentCount)
      },
      create: (url: string, ipHash: string | null, userId: string | null, source?: string) => {
        created = { url, ipHash, userId, source }
        return Promise.resolve({ id: 'scan-1', status: 'queued' })
      },
    }),
}))

mock.module('@/lib/supabase/server.ts', () => ({
  ...realServer,
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    }),
}))

mock.module('@/lib/run-scan.ts', () => ({
  ...realRunScan,
  runScan: () => Promise.resolve(),
}))

mock.module('@/lib/smart-agent/smart-pref.ts', () => ({
  ...realSmartPref,
  smartAgentEnabledForScan: () => Promise.resolve(false),
}))

mock.module('next/server', () => ({
  ...realNextServer,
  after: () => {},
}))

const { POST } = await import('./route')

afterAll(() => {
  mock.module('@/lib/scan-store.ts', () => realStore)
  mock.module('@/lib/supabase/server.ts', () => realServer)
  mock.module('@/lib/run-scan.ts', () => realRunScan)
  mock.module('@/lib/smart-agent/smart-pref.ts', () => realSmartPref)
  mock.module('next/server', () => realNextServer)
  if (realProxyTokenSecret === undefined) {
    delete process.env.PROXY_TOKEN_SECRET
  } else {
    process.env.PROXY_TOKEN_SECRET = realProxyTokenSecret
  }
})

beforeEach(() => {
  recentCount = 0
  throwOnCount = false
  capturedIpHash = null
  created = null
})

function scanRequest(
  headers: Record<string, string> = {},
  body: unknown = { url: 'https://example.com' },
): Request {
  return new Request('https://isready.ai/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// MARK: - Rate limiting

describe('POST /api/scan rate limiting', () => {
  test('passes through under the limit (202)', async () => {
    recentCount = 0
    const res = await POST(scanRequest())
    expect(res.status).toBe(202)
    const body = (await res.json()) as { id: string; status: string; proxyToken?: string }
    expect(body.id).toBe('scan-1')
    expect(body.status).toBe('queued')
    // The route mints a host-bound proxy token alongside the scan id.
    expect(typeof body.proxyToken).toBe('string')
  })

  test('passes at exactly one below the limit', async () => {
    recentCount = 29
    const res = await POST(scanRequest())
    expect(res.status).toBe(202)
  })

  test('rejects at the limit with 429', async () => {
    recentCount = 30
    const res = await POST(scanRequest())
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
  })

  test('rejects over the limit with 429', async () => {
    recentCount = 100
    const res = await POST(scanRequest())
    expect(res.status).toBe(429)
  })

  test('FAILS CLOSED with 429 when the limiter read throws', async () => {
    throwOnCount = true
    const res = await POST(scanRequest())
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
    // The scan must never be created when the limiter is unconsultable.
    expect(created).toBeNull()
  })
})

// MARK: - Client IP derivation (trusted source, not raw XFF)

describe('POST /api/scan client IP', () => {
  test('prefers the platform x-real-ip header', async () => {
    await POST(scanRequest({ 'x-real-ip': '203.0.113.5' }))
    expect(capturedIpHash).toBe(await sha256Hex('203.0.113.5'))
  })

  test('x-real-ip wins even when x-forwarded-for is present and spoofed', async () => {
    await POST(scanRequest({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))
    expect(capturedIpHash).toBe(await sha256Hex('203.0.113.5'))
  })

  test('falls back to the RIGHTMOST forwarded hop (our proxy), not the spoofable leftmost', async () => {
    await POST(scanRequest({ 'x-forwarded-for': '9.9.9.9, 5.5.5.5' }))
    // Attacker-supplied leftmost (9.9.9.9) is ignored; the trusted rightmost is used.
    expect(capturedIpHash).toBe(await sha256Hex('5.5.5.5'))
    expect(capturedIpHash).not.toBe(await sha256Hex('9.9.9.9'))
  })

  test("uses the single 'local' bucket when no trusted header is present", async () => {
    await POST(scanRequest())
    expect(capturedIpHash).toBe(await sha256Hex('local'))
  })
})

// MARK: - Body / URL validation (after the rate gate)

describe('POST /api/scan validation', () => {
  test('rejects a malformed body with 400', async () => {
    const res = await POST(scanRequest({}, { notUrl: true }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_body' })
  })

  test('rejects a private/invalid URL with a 400 reason code', async () => {
    const res = await POST(scanRequest({}, { url: 'http://localhost' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error.startsWith('invalid_url:')).toBe(true)
  })

  test('attributes anonymous scans with no user id', async () => {
    await POST(scanRequest())
    expect(created?.userId).toBeNull()
    expect(created?.source).toBe('web')
  })
})
