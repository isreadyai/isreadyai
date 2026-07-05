import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

// MARK: - verifiedDomainBadgeScore host lookup
//
// The public badge authorizes on proven DNS ownership: the score is read for a
// VERIFIED, badge-activated, paid host. `websites.host` is STORED canonicalized
// (lowercased, leading `www.` stripped — see addTrackedDomain), so the lookup MUST
// canonicalize the requested host the SAME way. Otherwise `/badge/www.deluisa.bio`
// (or a mixed-case host) misses the row and a verified/paid site wrongly falls
// through to the locked badge instead of showing its latest score.
//
// Anti-leak design mirrors api-keys.test.ts: `isSupabaseConfigured` is left REAL
// (driven by env), and the whole service client — including the owner-plan gate
// (workspace_members + profiles) — is satisfied through ONE chainable mock that
// defaults to `{ data: null }`. Nothing else (e.g. `@/lib/workspace`) is mocked,
// so a cross-file leak degrades to "no row" instead of corrupting sibling suites.

const realSupabase = await import('@isreadyai/supabase')

// The stored (canonical) host the fake `websites` row lives under.
const STORED_HOST = 'deluisa.bio'

interface IStub {
  websiteRow: unknown
  scans: unknown[]
}
let stub: IStub
// The value the code passes to the `websites` `.eq('host', …)` filter.
let capturedHost: string | null = null

/** A minimal, VALID scan report (passes isScanReport) with a chosen host + score. */
function scanReport(finalUrl: string, overall: number): Record<string, unknown> {
  return {
    url: finalUrl,
    finalUrl,
    scoreVersion: 'test',
    overall,
    grade: 'good',
    categories: [],
    checks: [],
    startedAt: '2026-07-02T09:00:00.000Z',
    finishedAt: '2026-07-02T09:00:01.000Z',
    meta: { durationMs: 1000, fetchOk: true },
  }
}

/**
 * The rows this fake service client hands back per table, resolved LAZILY at await
 * time so the `websites` lookup can decide its row from the host the code filtered
 * on (proving the lookup canonicalized it). `single` feeds `.maybeSingle()`, `list`
 * feeds a directly-awaited query.
 */
function tableResult(table: string): { list: unknown; single: unknown } {
  switch (table) {
    case 'websites':
      // The verified/paid row exists ONLY under the stored canonical host.
      return { single: capturedHost === STORED_HOST ? stub.websiteRow : null, list: null }
    case 'workspace_members':
      // ownerPlanForWorkspace → the owner (.maybeSingle); scoreForWorkspaceHost → members (awaited).
      return { single: { user_id: 'owner-1' }, list: [{ user_id: 'owner-1' }] }
    case 'profiles':
      // ownerPlanForWorkspace → the owner's plan (paid, so the badge gate opens).
      return { single: { plan: 'team' }, list: null }
    case 'scans':
      return { single: null, list: stub.scans }
    default:
      return { single: null, list: null }
  }
}

/** A Supabase query builder that is both chainable and awaitable. */
function builder(table: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the query builder
  const proxy: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thenable passthrough
        return (onF: any, onR: any) =>
          Promise.resolve({ data: tableResult(table).list, error: null }).then(onF, onR)
      }
      if (prop === 'catch' || prop === 'finally') {
        return () => Promise.resolve({ data: tableResult(table).list, error: null })
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: tableResult(table).single, error: null })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chainable filter args
      return (...args: any[]) => {
        if (prop === 'eq' && args[0] === 'host') {
          capturedHost = args[1] as string
        }
        return proxy
      }
    },
  })
  return proxy
}

const serviceClient = { from: (table: string): unknown => builder(table) }

mock.module('@isreadyai/supabase', () => ({
  ...realSupabase,
  createServiceClient: () => Promise.resolve(serviceClient),
}))

const { verifiedDomainBadgeScore } = await import('./badge-score')

const savedEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  secret: process.env.SUPABASE_SECRET_KEY,
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.SUPABASE_SECRET_KEY = 'test-secret-key'
  capturedHost = null
  stub = {
    websiteRow: {
      workspace_id: 'ws-1',
      badge_enabled: true,
      public_report_id: null,
    },
    scans: [
      {
        url: 'https://deluisa.bio',
        report: scanReport('https://deluisa.bio/', 89),
        site_report: null,
        smart_report: null,
        smart_site_report: null,
      },
    ],
  }
})

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

describe('verifiedDomainBadgeScore — host canonicalization', () => {
  test('exact stored host resolves to the latest score', async () => {
    const result = await verifiedDomainBadgeScore('deluisa.bio')
    expect(capturedHost).toBe('deluisa.bio')
    expect(result?.score).toBe(89)
  })

  test('a www. host still resolves to the same verified site (not the locked badge)', async () => {
    const result = await verifiedDomainBadgeScore('www.deluisa.bio')
    // The lookup must canonicalize to the stored host…
    expect(capturedHost).toBe('deluisa.bio')
    // …so the verified/paid site shows its score instead of falling through to null.
    expect(result).not.toBeNull()
    expect(result?.score).toBe(89)
  })

  test('a mixed-case host is lowercased to the stored host', async () => {
    const result = await verifiedDomainBadgeScore('DELUISA.bio')
    expect(capturedHost).toBe('deluisa.bio')
    expect(result?.score).toBe(89)
  })
})
