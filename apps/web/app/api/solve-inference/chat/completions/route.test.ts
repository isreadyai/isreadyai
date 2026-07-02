import { afterAll, describe, expect, test } from 'bun:test'
import { signSolveToken, type ISolveClaims } from '@/lib/solve-token'
import { forwardedInputBytes, inputTooLarge, POST, sanitizeInferenceBody } from './route.ts'

const MODEL = 'anthropic/claude-sonnet-4.6'
const CAP = 4096

describe('sanitizeInferenceBody', () => {
  test('strips n and forces it to 1', () => {
    const out = sanitizeInferenceBody({ n: 100, messages: [] }, MODEL, CAP)

    expect(out.n).toBe(1)
  })

  test('drops non-whitelisted fields', () => {
    const out = sanitizeInferenceBody(
      { messages: [], frequency_penalty: 2, logit_bias: {}, user: 'x' },
      MODEL,
      CAP,
    )

    expect(out).not.toHaveProperty('frequency_penalty')
    expect(out).not.toHaveProperty('logit_bias')
    expect(out).not.toHaveProperty('user')
  })

  test('pins the model and caps max_tokens', () => {
    const out = sanitizeInferenceBody({ model: 'gpt-4o', max_tokens: 999999 }, MODEL, CAP)

    expect(out.model).toBe(MODEL)
    expect(out.max_tokens).toBe(CAP)
  })

  test('forwards whitelisted fields and defaults max_tokens', () => {
    const messages = [{ role: 'user', content: 'hi' }]
    const out = sanitizeInferenceBody(
      { messages, temperature: 0.2, stream: true, tools: [], tool_choice: 'auto' },
      MODEL,
      CAP,
    )

    expect(out.messages).toBe(messages)
    expect(out.temperature).toBe(0.2)
    expect(out.stream).toBe(true)
    expect(out.tools).toEqual([])
    expect(out.tool_choice).toBe('auto')
    expect(out.max_tokens).toBe(CAP)
  })
})

describe('inputTooLarge', () => {
  test('allows a normal conversation', () => {
    expect(inputTooLarge({ messages: [{ role: 'user', content: 'hi' }] })).toBe(false)
  })

  test('rejects an oversized messages payload', () => {
    expect(inputTooLarge({ messages: [{ role: 'user', content: 'x'.repeat(100_001) }] })).toBe(true)
  })

  test('counts tools toward the cap, not just messages', () => {
    expect(inputTooLarge({ messages: [], tools: [{ blob: 'x'.repeat(100_001) }] })).toBe(true)
  })

  test('ignores non-forwarded fields when sizing', () => {
    expect(inputTooLarge({ messages: [], user: 'x'.repeat(100_001) })).toBe(false)
  })

  test('treats an empty body as allowed', () => {
    expect(inputTooLarge({})).toBe(false)
  })
})

// MARK: - POST 413 body (bug 413 — client needs max_bytes/got_bytes to prune deterministically)

describe('POST request_too_large body', () => {
  const secret = 'test-solve-token-secret-0123456789ab'
  const realSecret = process.env.SOLVE_TOKEN_SECRET
  const realGatewayKey = process.env.AI_GATEWAY_API_KEY
  process.env.SOLVE_TOKEN_SECRET = secret
  process.env.AI_GATEWAY_API_KEY = 'test-gateway-key'

  afterAll(() => {
    if (realSecret === undefined) {
      delete process.env.SOLVE_TOKEN_SECRET
    } else {
      process.env.SOLVE_TOKEN_SECRET = realSecret
    }
    if (realGatewayKey === undefined) {
      delete process.env.AI_GATEWAY_API_KEY
    } else {
      process.env.AI_GATEWAY_API_KEY = realGatewayKey
    }
  })

  async function oversizedRequest(jti: string): Promise<Request> {
    const claims: ISolveClaims = {
      sub: 'key-1',
      scope: 'inference',
      model: MODEL,
      jti,
      calls: 10,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    }
    const token = await signSolveToken(claims, secret)
    return new Request('https://isready.ai/api/solve-inference/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(150_000) }] }),
    })
  }

  test('reports max_bytes and the actual got_bytes alongside the error code', async () => {
    const res = await POST(await oversizedRequest('run-413-a'))

    expect(res.status).toBe(413)
    const body = (await res.json()) as { error: string; max_bytes: number; got_bytes: number }
    expect(body.error).toBe('request_too_large')
    expect(body.max_bytes).toBe(100_000)
    expect(body.got_bytes).toBeGreaterThan(100_000)
  })

  test('got_bytes matches forwardedInputBytes for the same body', async () => {
    const request = await oversizedRequest('run-413-b')
    const expectedBytes = forwardedInputBytes(
      JSON.parse(await request.clone().text()) as Record<string, unknown>,
    )

    const res = await POST(request)

    const body = (await res.json()) as { got_bytes: number }
    expect(body.got_bytes).toBe(expectedBytes)
  })
})
