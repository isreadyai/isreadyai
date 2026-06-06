import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { EPlan } from '@/lib/plans'

// MARK: - POST /api/fix-plan rate-limit test setup
//
// `verifyApiKey` / `consumeRateLimit` are mocked at the factory boundary so the
// per-minute rate gate can be exercised without a live database or a funded AI
// call. AI_GATEWAY_API_KEY is set so fixPlanConfigured() doesn't short-circuit
// with 503 before the gate under test even runs. Everything is restored in
// afterAll so nothing leaks into sibling suites.

let keyResult: { id: string; plan: (typeof EPlan)[keyof typeof EPlan] } | null
let rateLimitAllowed: boolean

const realApiKeys = await import('@/lib/api-keys')
const realRateLimit = await import('@/lib/rate-limit')

const realGatewayKey = process.env.AI_GATEWAY_API_KEY
process.env.AI_GATEWAY_API_KEY = 'test-gateway-key'

mock.module('@/lib/api-keys', () => ({
  ...realApiKeys,
  verifyApiKey: () => Promise.resolve(keyResult),
}))

mock.module('@/lib/rate-limit', () => ({
  ...realRateLimit,
  consumeRateLimit: () => Promise.resolve(rateLimitAllowed),
}))

const { POST } = await import('./route')

afterAll(() => {
  mock.module('@/lib/api-keys', () => realApiKeys)
  mock.module('@/lib/rate-limit', () => realRateLimit)
  if (realGatewayKey === undefined) {
    delete process.env.AI_GATEWAY_API_KEY
  } else {
    process.env.AI_GATEWAY_API_KEY = realGatewayKey
  }
})

beforeEach(() => {
  keyResult = { id: 'key-1', plan: EPlan.PRO }
  rateLimitAllowed = true
})

function planRequest(body: unknown = { report: {} }): Request {
  return new Request('https://isready.ai/api/fix-plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-key' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/fix-plan rate limiting', () => {
  test('rejects a burst past the per-minute limit with 429 rate_limited', async () => {
    rateLimitAllowed = false

    const res = await POST(planRequest())

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
  })

  test('passes through under the limit (reaches report validation, not the rate gate)', async () => {
    rateLimitAllowed = true

    const res = await POST(planRequest({ report: {} }))

    // Proven to be past the rate gate: it now fails on report shape (400), not
    // the 429 the rate limiter would have produced.
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_report' })
  })

  test('still enforces the premium gate before the rate limiter', async () => {
    keyResult = { id: 'key-1', plan: EPlan.FREE }
    rateLimitAllowed = false

    const res = await POST(planRequest())

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'premium_required',
      upgrade: 'https://isready.ai/#pricing',
    })
  })
})
