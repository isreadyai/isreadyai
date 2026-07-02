import { afterEach, describe, expect, mock, test } from 'bun:test'
import { verifyTurnstile } from '@/lib/turnstile-verify'

// MARK: - Turnstile server-side verification

const ENV = {
  secret: process.env.TURNSTILE_SECRET_KEY,
  vercel: process.env.VERCEL_ENV,
}
const realFetch = globalThis.fetch

afterEach(() => {
  process.env.TURNSTILE_SECRET_KEY = ENV.secret
  process.env.VERCEL_ENV = ENV.vercel
  globalThis.fetch = realFetch
})

function setEnv(secret: string | undefined, vercelEnv: string | undefined): void {
  if (secret === undefined) {
    delete process.env.TURNSTILE_SECRET_KEY
  } else {
    process.env.TURNSTILE_SECRET_KEY = secret
  }
  if (vercelEnv === undefined) {
    delete process.env.VERCEL_ENV
  } else {
    process.env.VERCEL_ENV = vercelEnv
  }
}

function mockSiteverify(success: boolean): void {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify({ success }), { status: 200 }),
  ) as unknown as typeof fetch
}

describe('verifyTurnstile', () => {
  test('missing secret fails OPEN in dev', async () => {
    setEnv('', undefined)
    expect(await verifyTurnstile('any')).toBe(true)
  })

  test('missing secret fails CLOSED in production', async () => {
    setEnv('', 'production')
    expect(await verifyTurnstile('any')).toBe(false)
  })

  test('empty token is rejected when a secret is set', async () => {
    setEnv('a-secret', undefined)
    expect(await verifyTurnstile('')).toBe(false)
  })

  test('honours the siteverify result', async () => {
    setEnv('a-secret', 'production')
    mockSiteverify(true)
    expect(await verifyTurnstile('tok')).toBe(true)
    mockSiteverify(false)
    expect(await verifyTurnstile('tok')).toBe(false)
  })

  test('a network error fails closed', async () => {
    setEnv('a-secret', 'production')
    globalThis.fetch = mock(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    expect(await verifyTurnstile('tok')).toBe(false)
  })
})
