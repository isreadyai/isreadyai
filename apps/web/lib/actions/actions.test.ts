import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

// MARK: - Server-action gating tests
//
// The Supabase clients are mocked at the factory boundary so the auth- and
// plan-gating branches can be exercised without a live database; RLS itself is
// enforced in Postgres and covered by the migration + badge route tests.

type TResult = { data?: unknown; error?: unknown }

function fakeClient(opts: { user?: { id: string } | null; result?: TResult }) {
  const result = opts.result ?? { data: null, error: null }
  const builder: Record<string, unknown> = {}
  const chain = (): Record<string, unknown> => builder
  for (const m of [
    'select',
    'eq',
    'is',
    'in',
    'not',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
  ]) {
    builder[m] = chain
  }
  builder.maybeSingle = (): Promise<TResult> => Promise.resolve(result)
  // The Supabase query builder is itself awaitable; mimic that thenable shape.
  // oxlint-disable-next-line unicorn/no-thenable
  builder.then = (resolve: (v: TResult) => unknown): unknown => resolve(result)
  return {
    auth: {
      getUser: (): Promise<{ data: { user: { id: string } | null } }> =>
        Promise.resolve({ data: { user: opts.user ?? null } }),
    },
    from: (): Record<string, unknown> => builder,
  }
}

let sessionClient: ReturnType<typeof fakeClient>
let serviceClient: ReturnType<typeof fakeClient>

// mock.module is process-global, so capture the real namespaces first and
// re-install them in afterAll — otherwise these mocks leak into other test files.
const realServer = await import('@/lib/supabase/server.ts')
const realSupabase = await import('@isreadyai/supabase')
const realCache = await import('next/cache')
const realWorkspace = await import('@/lib/workspace')

mock.module('@/lib/supabase/server.ts', () => ({
  ...realServer,
  createServerSupabaseClient: () => Promise.resolve(sessionClient),
}))
mock.module('@isreadyai/supabase', () => ({
  ...realSupabase,
  createServiceClient: () => Promise.resolve(serviceClient),
}))
mock.module('next/cache', () => ({ ...realCache, revalidatePath: () => {} }))
// createApiKey resolves the active workspace + the caller's role through cookies
// and the DB, which the fakeClient can't model; stub it to an owner so the
// success path runs (the no_workspace/role branches are gating, not asserted here).
mock.module('@/lib/workspace', () => ({
  ...realWorkspace,
  getActiveWorkspaceId: () => Promise.resolve('ws1'),
  getMemberRole: () => Promise.resolve('owner'),
}))

const { createApiKey, revokeApiKey } = await import('./api-keys')
const { claimBadgeDomain } = await import('./badge')

const SECRET = 'badge-signing-secret-at-least-32-characters'
const savedSecret = process.env.BADGE_SIGNING_SECRET

beforeAll(() => {
  process.env.BADGE_SIGNING_SECRET = SECRET
})
afterAll(() => {
  mock.module('@/lib/supabase/server.ts', () => realServer)
  mock.module('@isreadyai/supabase', () => realSupabase)
  mock.module('next/cache', () => realCache)
  mock.module('@/lib/workspace', () => realWorkspace)
  if (savedSecret === undefined) {
    delete process.env.BADGE_SIGNING_SECRET
  } else {
    process.env.BADGE_SIGNING_SECRET = savedSecret
  }
})

describe('createApiKey', () => {
  test('rejects an unauthenticated caller', async () => {
    sessionClient = fakeClient({ user: null })
    expect(await createApiKey('label')).toEqual({ ok: false, error: 'unauthenticated' })
  })

  test('fails when the user has no profile', async () => {
    sessionClient = fakeClient({ user: { id: 'u1' }, result: { data: null } })
    expect(await createApiKey('label')).toEqual({ ok: false, error: 'no_profile' })
  })

  test('mints a prefixed raw key on success', async () => {
    sessionClient = fakeClient({ user: { id: 'u1' }, result: { data: { plan: 'pro' } } })
    serviceClient = fakeClient({ result: { error: null } })
    const out = await createApiKey('  my key  ')
    expect(out.ok).toBe(true)
    if (!out.ok) {
      throw new Error(out.error)
    }
    expect(out.rawKey.startsWith('isr_')).toBe(true)
  })
})

describe('revokeApiKey', () => {
  test('rejects an unauthenticated caller', async () => {
    sessionClient = fakeClient({ user: null })
    expect(await revokeApiKey('k1')).toEqual({ ok: false, error: 'unauthenticated' })
  })

  test('refuses a key that does not exist', async () => {
    sessionClient = fakeClient({ user: { id: 'u1' } })
    serviceClient = fakeClient({ result: { data: null, error: null } })
    expect(await revokeApiKey('k1')).toEqual({ ok: false, error: 'not_found' })
  })

  test('revokes a key the caller manages', async () => {
    sessionClient = fakeClient({ user: { id: 'u1' } })
    serviceClient = fakeClient({
      result: {
        data: { id: 'k1', workspace_id: 'w1', user_id: 'u1', revoked_at: null },
        error: null,
      },
    })
    expect(await revokeApiKey('k1')).toEqual({ ok: true })
  })
})

describe('claimBadgeDomain', () => {
  test('rejects an unauthenticated caller', async () => {
    sessionClient = fakeClient({ user: null })
    expect(await claimBadgeDomain('k1', 'example.com')).toEqual({
      ok: false,
      error: 'unauthenticated',
    })
  })

  test('rejects a malformed domain', async () => {
    sessionClient = fakeClient({ user: { id: 'u1' } })
    expect(await claimBadgeDomain('k1', 'not a domain')).toEqual({
      ok: false,
      error: 'invalid_domain',
    })
  })

  test('lets a free plan claim its first site (badge is free)', async () => {
    sessionClient = fakeClient({
      user: { id: 'u1' },
      result: { data: { id: 'k1', plan: 'free', badge_domains: [], revoked_at: null } },
    })
    serviceClient = fakeClient({ result: { error: null } })
    const out = await claimBadgeDomain('k1', 'example.com')
    expect(out.ok).toBe(true)
  })

  test('blocks a free plan once its single-site quota is used', async () => {
    sessionClient = fakeClient({
      user: { id: 'u1' },
      result: { data: { id: 'k1', plan: 'free', badge_domains: ['taken.com'], revoked_at: null } },
    })
    expect(await claimBadgeDomain('k1', 'example.com')).toEqual({
      ok: false,
      error: 'upgrade_required',
    })
  })

  test('returns embeddable markdown for a pro key', async () => {
    sessionClient = fakeClient({
      user: { id: 'u1' },
      result: { data: { id: 'k1', plan: 'pro', badge_domains: [], revoked_at: null } },
    })
    serviceClient = fakeClient({ result: { error: null } })
    const out = await claimBadgeDomain('k1', 'example.com')
    expect(out.ok).toBe(true)
    if (!out.ok) {
      throw new Error(out.error)
    }
    expect(out.markdown).toContain('/badge/example.com?token=')
  })
})
