import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { EPlan } from '@/lib/plans'
import { verifySolveToken } from '@/lib/solve-token'

// MARK: - POST /api/solve-token jti <-> fix_runs.id correlation
//
// `verifyApiKey` / `consumeMeteredRun` / `solveQuota` / `consumeRateLimit` are
// mocked at the factory boundary so the mint flow can be exercised without a
// live database. SOLVE_TOKEN_SECRET is pinned to a deterministic test value so
// this suite doesn't depend on ambient .env state. Everything is restored in
// afterAll so nothing leaks into sibling suites.

let keyResult: { id: string; plan: (typeof EPlan)[keyof typeof EPlan] } | null
let reservedRunId: string | null
let capturedMeteredRun: { kind: string; repo: string; url: string; patches: number } | null
let rateLimitAllowed: boolean

const realApiKeys = await import('@/lib/api-keys')
const realRateLimit = await import('@/lib/rate-limit')

const realSecret = process.env.SOLVE_TOKEN_SECRET
process.env.SOLVE_TOKEN_SECRET = 'test-solve-token-secret-0123456789ab'

mock.module('@/lib/api-keys', () => ({
  ...realApiKeys,
  verifyApiKey: () => Promise.resolve(keyResult),
  consumeMeteredRun: (
    _key: unknown,
    run: { kind: string; repo: string; url: string; patches: number },
  ) => {
    capturedMeteredRun = run
    return Promise.resolve(reservedRunId)
  },
  solveQuota: () => Promise.resolve({ used: 0, limit: 1000 }),
}))

mock.module('@/lib/rate-limit', () => ({
  ...realRateLimit,
  consumeRateLimit: () => Promise.resolve(rateLimitAllowed),
}))

const { POST } = await import('./route')

afterAll(() => {
  mock.module('@/lib/api-keys', () => realApiKeys)
  mock.module('@/lib/rate-limit', () => realRateLimit)
  if (realSecret === undefined) {
    delete process.env.SOLVE_TOKEN_SECRET
  } else {
    process.env.SOLVE_TOKEN_SECRET = realSecret
  }
})

beforeEach(() => {
  keyResult = { id: 'key-1', plan: EPlan.PRO }
  reservedRunId = 'reserved-run-id-123'
  capturedMeteredRun = null
  rateLimitAllowed = true
})

function tokenRequest(body: unknown = {}): Request {
  return new Request('https://isready.ai/api/solve-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-key' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/solve-token', () => {
  test('mints a token whose jti equals the reserved fix_runs id', async () => {
    const res = await POST(tokenRequest({ repo: 'owner/repo' }))

    expect(res.status).toBe(200)
    const body = (await res.json()) as { token: string }
    const claims = await verifySolveToken(body.token, process.env.SOLVE_TOKEN_SECRET as string)
    expect(claims?.jti).toBe('reserved-run-id-123')
  })

  test('reserves the run (kind solve, given repo) before minting', async () => {
    await POST(tokenRequest({ repo: 'owner/repo' }))

    expect(capturedMeteredRun?.kind).toBe('solve')
    expect(capturedMeteredRun?.repo).toBe('owner/repo')
  })

  test('a different reservation id produces a token with that same jti', async () => {
    reservedRunId = 'another-run-id-456'

    const res = await POST(tokenRequest({ repo: 'owner/repo' }))

    const body = (await res.json()) as { token: string }
    const claims = await verifySolveToken(body.token, process.env.SOLVE_TOKEN_SECRET as string)
    expect(claims?.jti).toBe('another-run-id-456')
  })

  test('returns 429 quota_exceeded (no token minted) when the reservation is denied', async () => {
    reservedRunId = null

    const res = await POST(tokenRequest({ repo: 'owner/repo' }))

    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('quota_exceeded')
  })

  test('rejects a free-plan key with 403 before ever reserving a run', async () => {
    keyResult = { id: 'key-1', plan: EPlan.FREE }

    const res = await POST(tokenRequest({ repo: 'owner/repo' }))

    expect(res.status).toBe(403)
    expect(capturedMeteredRun).toBeNull()
  })
})
