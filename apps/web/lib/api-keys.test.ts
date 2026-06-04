import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { EPlan } from '@/lib/plans'

// MARK: - API key + metering tests
//
// `createServiceClient` is mocked at the factory boundary so the Postgres
// branches of verifyApiKey / fixQuota / consumeMeteredRun can be exercised without a
// live database. Two anti-leak measures matter for the full-suite `bun test`:
//   1. `isSupabaseConfigured` is NOT mocked — it is driven by real env vars so a
//      leak can't force-activate Supabase paths (e.g. the badge route) under CI.
//   2. The query builder is fully chainable (`.not/.is/.in/.order/.limit`) and
//      defaults to `{ data: null }`, so even a leaked client degrades to "no row"
//      instead of crashing badge-score's `.eq().not()` chain.

type TResult = { data?: unknown; error?: unknown; count?: unknown }
type TTableConfig = { result?: TResult; onInsert?: (payload: unknown) => void }

function makeBuilder(config: TTableConfig): Record<string, unknown> {
  // Supabase always returns explicit `data: null` / `error: null` rather than
  // absent fields; default them so callers that branch on `=== null` behave like
  // production (and so a leaked mock degrades to "no row" instead of crashing).
  const result: TResult = { data: null, error: null, ...config.result }
  const builder: Record<string, unknown> = {}
  const chain = (): Record<string, unknown> => builder
  for (const m of [
    'select',
    'eq',
    'neq',
    'or',
    'is',
    'in',
    'not',
    'gte',
    'lte',
    'order',
    'limit',
    'match',
  ]) {
    builder[m] = chain
  }
  builder.insert = (payload: unknown): Record<string, unknown> => {
    config.onInsert?.(payload)
    return builder
  }
  builder.maybeSingle = (): Promise<TResult> => Promise.resolve(result)
  // The Supabase query builder is itself awaitable; mimic that thenable shape so
  // count/insert calls that are `await`ed without `.maybeSingle()` resolve too.
  // oxlint-disable-next-line unicorn/no-thenable
  builder.then = (resolve: (v: TResult) => unknown): unknown => resolve(result)
  return builder
}

function fakeClient(
  byTable: Record<string, TTableConfig>,
  rpcResult: TResult = { data: null, error: null },
): {
  from: (table: string) => unknown
  rpc: (fn: string, args: unknown) => Promise<TResult>
} {
  return {
    from: (table: string): unknown => makeBuilder(byTable[table] ?? {}),
    rpc: (_fn: string, _args: unknown): Promise<TResult> => Promise.resolve(rpcResult),
  }
}

let serviceClient: ReturnType<typeof fakeClient>

const realSupabase = await import('@isreadyai/supabase')

// Only createServiceClient is mocked — `isSupabaseConfigured` is left REAL and
// driven by env vars (see configureSupabase). Mocking isSupabaseConfigured would
// leak `true` into sibling suites (bun's mock.module restore is unreliable across
// files), wrongly activating Supabase paths — e.g. the badge route — under CI.
mock.module('@isreadyai/supabase', () => ({
  ...realSupabase,
  createServiceClient: () => Promise.resolve(serviceClient),
}))

const { verifyApiKey, findApiKeyById, fixQuota, solveQuota, consumeMeteredRun } =
  await import('./api-keys')

const savedEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  secret: process.env.SUPABASE_SECRET_KEY,
  devKey: process.env.ISREADYAI_DEV_API_KEY,
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

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

beforeEach(() => {
  configureSupabase(true)
  serviceClient = fakeClient({})
  delete process.env.ISREADYAI_DEV_API_KEY
})

afterEach(() => {
  restoreEnv('NEXT_PUBLIC_SUPABASE_URL', savedEnv.url)
  restoreEnv('SUPABASE_SECRET_KEY', savedEnv.secret)
  restoreEnv('ISREADYAI_DEV_API_KEY', savedEnv.devKey)
})

afterAll(() => {
  mock.module('@isreadyai/supabase', () => realSupabase)
})

// MARK: - verifyApiKey

describe('verifyApiKey (dev / no-Supabase backend)', () => {
  test('unlocks the in-memory free key for the matching raw key', async () => {
    configureSupabase(false)
    process.env.ISREADYAI_DEV_API_KEY = 'isr_dev'
    expect(await verifyApiKey('isr_dev')).toEqual({ id: 'dev-key', plan: EPlan.FREE })
  })

  test('rejects a non-matching raw key', async () => {
    configureSupabase(false)
    process.env.ISREADYAI_DEV_API_KEY = 'isr_dev'
    expect(await verifyApiKey('wrong')).toBeNull()
  })

  test('rejects when no dev key is configured', async () => {
    configureSupabase(false)
    expect(await verifyApiKey('anything')).toBeNull()
  })
})

describe('verifyApiKey (Supabase backend)', () => {
  test('returns the workspace owner plan for a live key', async () => {
    serviceClient = fakeClient({
      api_keys: {
        result: { data: { id: 'k1', user_id: 'u1', workspace_id: 'w1', revoked_at: null } },
      },
      workspace_members: { result: { data: { user_id: 'owner1' } } },
      profiles: { result: { data: { plan: 'pro' } } },
    })
    expect(await verifyApiKey('raw')).toEqual({ id: 'k1', plan: EPlan.PRO })
  })

  test('returns null for an unknown key (no row)', async () => {
    serviceClient = fakeClient({ api_keys: { result: { data: null } } })
    expect(await verifyApiKey('raw')).toBeNull()
  })

  test('returns null for a revoked key', async () => {
    serviceClient = fakeClient({
      api_keys: {
        result: { data: { id: 'k1', user_id: 'u1', revoked_at: '2026-01-01T00:00:00Z' } },
      },
    })
    expect(await verifyApiKey('raw')).toBeNull()
  })

  test('returns null on a query error', async () => {
    serviceClient = fakeClient({
      api_keys: { result: { data: null, error: { message: 'boom' } } },
    })
    expect(await verifyApiKey('raw')).toBeNull()
  })

  test('returns null when the key has no owner (user_id null)', async () => {
    serviceClient = fakeClient({
      api_keys: { result: { data: { id: 'k1', user_id: null, revoked_at: null } } },
    })
    expect(await verifyApiKey('raw')).toBeNull()
  })

  test('fails closed when a legacy (workspace-less) key owner profile is gone', async () => {
    serviceClient = fakeClient({
      api_keys: {
        result: { data: { id: 'k1', user_id: 'u1', workspace_id: null, revoked_at: null } },
      },
      profiles: { result: { data: null } },
    })
    expect(await verifyApiKey('raw')).toBeNull()
  })

  test('normalizes an unrecognized owner plan down to free', async () => {
    serviceClient = fakeClient({
      api_keys: {
        result: { data: { id: 'k1', user_id: 'u1', workspace_id: 'w1', revoked_at: null } },
      },
      workspace_members: { result: { data: { user_id: 'owner1' } } },
      profiles: { result: { data: { plan: 'enterprise' } } },
    })
    expect(await verifyApiKey('raw')).toEqual({ id: 'k1', plan: EPlan.FREE })
  })
})

describe('findApiKeyById', () => {
  test('returns the dev key when ids match and no Supabase', async () => {
    configureSupabase(false)
    process.env.ISREADYAI_DEV_API_KEY = 'isr_dev'
    expect(await findApiKeyById('dev-key')).toEqual({ id: 'dev-key', plan: EPlan.FREE })
  })

  test('returns null for a mismatched dev id', async () => {
    configureSupabase(false)
    process.env.ISREADYAI_DEV_API_KEY = 'isr_dev'
    expect(await findApiKeyById('other')).toBeNull()
  })

  test('resolves a live key by id via the workspace owner plan', async () => {
    serviceClient = fakeClient({
      api_keys: {
        result: { data: { id: 'k1', user_id: 'u1', workspace_id: 'w1', revoked_at: null } },
      },
      workspace_members: { result: { data: { user_id: 'owner1' } } },
      profiles: { result: { data: { plan: 'team' } } },
    })
    expect(await findApiKeyById('k1')).toEqual({ id: 'k1', plan: EPlan.TEAM })
  })
})

// MARK: - Quota math

describe('fixQuota', () => {
  test('reports the plan limit and the counted used rows', async () => {
    serviceClient = fakeClient({ fix_runs: { result: { count: 5, error: null } } })
    expect(await fixQuota({ id: 'k1', plan: EPlan.PRO })).toEqual({ used: 5, limit: 200 })
  })

  test('team plan limit is 1000', async () => {
    serviceClient = fakeClient({ fix_runs: { result: { count: 12, error: null } } })
    expect(await fixQuota({ id: 'k1', plan: EPlan.TEAM })).toEqual({ used: 12, limit: 1000 })
  })

  test('fails closed (used = limit) when the metering read errors', async () => {
    serviceClient = fakeClient({
      fix_runs: { result: { count: null, error: { message: 'boom' } } },
    })
    expect(await fixQuota({ id: 'k1', plan: EPlan.PRO })).toEqual({ used: 200, limit: 200 })
  })

  test('free plan limit is 0 (fix-PR is premium)', async () => {
    serviceClient = fakeClient({ fix_runs: { result: { count: 0, error: null } } })
    expect(await fixQuota({ id: 'k1', plan: EPlan.FREE })).toEqual({ used: 0, limit: 0 })
  })

  test('dev backend counts in-memory runs against the plan limit', async () => {
    configureSupabase(false)
    const quota = await fixQuota({ id: 'dev-key', plan: EPlan.PRO })
    expect(quota.limit).toBe(200)
    expect(quota.used).toBeGreaterThanOrEqual(0)
  })
})

describe('solveQuota', () => {
  test('reports counted solve runs against the plan limit', async () => {
    serviceClient = fakeClient({ fix_runs: { result: { count: 7, error: null } } })
    expect(await solveQuota({ id: 'k1', plan: EPlan.TEAM })).toEqual({ used: 7, limit: 1000 })
  })

  test('fails closed (used = limit) when the read errors', async () => {
    serviceClient = fakeClient({
      fix_runs: { result: { count: null, error: { message: 'boom' } } },
    })
    expect(await solveQuota({ id: 'k1', plan: EPlan.PRO })).toEqual({ used: 200, limit: 200 })
  })
})

// MARK: - Metered run consumption (atomic reserve)

describe('consumeMeteredRun', () => {
  test('reserves under the limit and returns a run id (supabase rpc)', async () => {
    serviceClient = fakeClient({}, { data: 'run-uuid-1', error: null })
    const id = await consumeMeteredRun(
      { id: 'k1', plan: EPlan.PRO },
      { kind: 'fix', repo: 'acme/site', url: 'https://acme.test', patches: 0 },
    )
    expect(id).toBe('run-uuid-1')
  })

  test('fails closed (null) on a metering/rpc error', async () => {
    serviceClient = fakeClient({}, { data: null, error: { message: 'boom' } })
    const id = await consumeMeteredRun(
      { id: 'k1', plan: EPlan.PRO },
      { kind: 'plan', repo: 'acme/site', url: 'https://acme.test', patches: 0 },
    )
    expect(id).toBeNull()
  })

  test('returns null at the limit (rpc reports no row)', async () => {
    serviceClient = fakeClient({}, { data: null, error: null })
    const id = await consumeMeteredRun(
      { id: 'k1', plan: EPlan.TEAM },
      { kind: 'solve', repo: 'acme/site', url: 'solve:x', patches: 0 },
    )
    expect(id).toBeNull()
  })

  test('denies the free plan (zero funded-run limit) without touching the DB', async () => {
    const id = await consumeMeteredRun(
      { id: 'k1', plan: EPlan.FREE },
      { kind: 'solve', repo: 'acme/site', url: 'solve:x', patches: 0 },
    )
    expect(id).toBeNull()
  })

  test('dev backend reserves in-memory and returns an id', async () => {
    configureSupabase(false)
    const id = await consumeMeteredRun(
      { id: 'dev-key', plan: EPlan.PRO },
      { kind: 'fix', repo: 'acme/site', url: 'https://acme.test', patches: 0 },
    )
    expect(typeof id).toBe('string')
  })
})
