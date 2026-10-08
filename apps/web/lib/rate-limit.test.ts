import { afterAll, describe, expect, mock, test } from 'bun:test'

// MARK: - Shared rate limiter

let rpcResult: { data: unknown; error: { message: string } | null } = { data: true, error: null }
let rpcArgs: unknown[] = []

const realSupabase = await import('@isreadyai/supabase')

// Only createServiceClient is mocked — isSupabaseConfigured is left REAL and
// driven by env (configureSupabase). Mocking isSupabaseConfigured would leak
// `true`/`false` into sibling suites (bun's mock.module restore is unreliable
// across files), breaking their dev/no-Supabase paths.
mock.module('@isreadyai/supabase', () => ({
  ...realSupabase,
  createServiceClient: () =>
    Promise.resolve({
      rpc: (_name: string, args: unknown) => {
        rpcArgs.push(args)
        return Promise.resolve(rpcResult)
      },
    }),
}))

const { consumeRateLimit, ERateLimitScope } = await import('./rate-limit')

const savedEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  secret: process.env.SUPABASE_SECRET_KEY,
}

/** Flip the REAL isSupabaseConfigured() by setting/clearing the env it reads. */
function configureSupabase(on: boolean): void {
  if (on) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key'
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SECRET_KEY
  }
}

afterAll(() => {
  mock.module('@isreadyai/supabase', () => realSupabase)
  if (savedEnv.url === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv.url
  }
  if (savedEnv.secret === undefined) {
    delete process.env.SUPABASE_SECRET_KEY
  } else {
    process.env.SUPABASE_SECRET_KEY = savedEnv.secret
  }
})

describe('consumeRateLimit — in-memory (dev / no Supabase)', () => {
  test('allows up to the limit then denies within the window', async () => {
    configureSupabase(false)
    const key = `dev:${Math.random()}`
    expect(await consumeRateLimit(ERateLimitScope.PROXY, key, 60_000, 2)).toBe(true)
    expect(await consumeRateLimit(ERateLimitScope.PROXY, key, 60_000, 2)).toBe(true)
    expect(await consumeRateLimit(ERateLimitScope.PROXY, key, 60_000, 2)).toBe(false)
  })

  test('keeps the same subject isolated across scopes', async () => {
    configureSupabase(false)
    const subject = `iso:${Math.random()}`
    expect(await consumeRateLimit(ERateLimitScope.PROXY, subject, 60_000, 1)).toBe(true)
    expect(await consumeRateLimit(ERateLimitScope.EMAIL_REPORT, subject, 60_000, 1)).toBe(true)
    expect(await consumeRateLimit(ERateLimitScope.PROXY, subject, 60_000, 1)).toBe(false)
  })
})

describe('consumeRateLimit — shared store', () => {
  test('returns the rpc verdict (allow / deny)', async () => {
    configureSupabase(true)
    rpcResult = { data: false, error: null }
    expect(await consumeRateLimit(ERateLimitScope.PROXY, 'k', 60_000, 5)).toBe(false)
    rpcResult = { data: true, error: null }
    expect(await consumeRateLimit(ERateLimitScope.PROXY, 'k', 60_000, 5)).toBe(true)
  })

  test('namespaces the bucket key as scope:subject', async () => {
    configureSupabase(true)
    rpcResult = { data: true, error: null }
    rpcArgs = []
    await consumeRateLimit(ERateLimitScope.PROXY, '1.2.3.4', 60_000, 5)
    expect(rpcArgs).toEqual([{ p_key: 'proxy:1.2.3.4', p_window_ms: 60_000, p_limit: 5 }])
  })

  test('fails open to the in-memory guard on an rpc error', async () => {
    configureSupabase(true)
    rpcResult = { data: null, error: { message: 'boom' } }
    // First hit for a fresh key passes via the in-memory fallback.
    expect(await consumeRateLimit(ERateLimitScope.PROXY, `err:${Math.random()}`, 60_000, 2)).toBe(
      true,
    )
  })
})
