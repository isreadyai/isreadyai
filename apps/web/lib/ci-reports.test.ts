import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { SITE_URL } from '@/lib/site'

// MARK: - ciReposForWorkspace workspace scoping
//
// ci_repos.user_id is the ACCOUNT that registered the repo (immutable), not the
// active workspace, so ciReposForWorkspace must scope through api_keys.workspace_id
// instead — the same linkage the usage and API-keys dashboard pages use for
// fix_runs. Mirrors the anti-leak pattern in badge-score.test.ts: one chainable,
// awaitable mock per table; `isSupabaseConfigured` stays real (driven by env).

const realSupabase = await import('@isreadyai/supabase')

interface IApiKeyRow {
  id: string
  workspace_id: string
  revoked_at: string | null
}
interface ICiRepoRow {
  id: string
  slug: string
  owner_repo: string
  api_key_id: string
}
interface ICiReportRow {
  repo_id: string
  branch: string
  commit_sha: string
  score: number
  grade: string
  created_at: string
}

interface IStub {
  apiKeys: IApiKeyRow[]
  ciRepos: ICiRepoRow[]
  ciReports: ICiReportRow[]
}
let stub: IStub

interface IBuilderState {
  eqs: Record<string, unknown>
  ins: Record<string, unknown[]>
}

function resolveList(table: string, state: IBuilderState): unknown[] {
  switch (table) {
    case 'api_keys':
      return stub.apiKeys.filter(
        (k) =>
          k.workspace_id === state.eqs.workspace_id &&
          (state.eqs.revoked_at === undefined || k.revoked_at === null),
      )
    case 'ci_repos': {
      const keyIds = state.ins.api_key_id ?? []
      return stub.ciRepos.filter((r) => keyIds.includes(r.api_key_id))
    }
    case 'ci_reports':
      return stub.ciReports
        .filter((r) => r.repo_id === state.eqs.repo_id)
        .toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    default:
      return []
  }
}

/** A Supabase query builder that is both chainable and awaitable. */
function builder(table: string): unknown {
  const state: IBuilderState = { eqs: {}, ins: {} }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the query builder
  const proxy: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thenable passthrough
        return (onF: any, onR: any) =>
          Promise.resolve({ data: resolveList(table, state), error: null }).then(onF, onR)
      }
      if (prop === 'catch' || prop === 'finally') {
        return () => Promise.resolve({ data: resolveList(table, state), error: null })
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => {
          const list = resolveList(table, state)
          return Promise.resolve({ data: list[0] ?? null, error: null })
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chainable filter args
      return (...args: any[]) => {
        if (prop === 'eq' || prop === 'is') {
          state.eqs[args[0]] = args[1]
        }
        if (prop === 'in') {
          state.ins[args[0]] = args[1]
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

const { assertRepoOwnership, CiRepoTakeoverError, ciBadgeLinks, ciReposForWorkspace } =
  await import('./ci-reports')

const savedEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  secret: process.env.SUPABASE_SECRET_KEY,
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.SUPABASE_SECRET_KEY = 'test-secret-key'
  stub = { apiKeys: [], ciRepos: [], ciReports: [] }
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

describe('assertRepoOwnership', () => {
  test('allows the same owner to re-upload', () => {
    expect(() => assertRepoOwnership('1234', 'user-a', 'user-a')).not.toThrow()
  })

  test('rejects a different account seizing the repo registration', () => {
    expect(() => assertRepoOwnership('1234', 'user-a', 'user-b')).toThrow(CiRepoTakeoverError)
  })

  test('rejects an upload against a repo whose owner is unknown', () => {
    expect(() => assertRepoOwnership('1234', null, 'user-b')).toThrow(CiRepoTakeoverError)
  })
})

describe('ciBadgeLinks', () => {
  test('builds badge/report URLs and README markdown from the same template', () => {
    const links = ciBadgeLinks('gh_abc123', 'main', 'abcdef1')

    expect(links.badgeUrl).toBe(`${SITE_URL}/badge/gh/gh_abc123/main`)
    expect(links.reportUrl).toBe(`${SITE_URL}/report/gh/gh_abc123/abcdef1`)
    expect(links.badgeMarkdown).toBe(`[![AI readiness](${links.badgeUrl})](${links.reportUrl})`)
  })

  test('URL-encodes the branch and commit segments', () => {
    const links = ciBadgeLinks('gh_abc123', 'feature/x', 'abc def')

    expect(links.badgeUrl).toBe(`${SITE_URL}/badge/gh/gh_abc123/feature%2Fx`)
    expect(links.reportUrl).toBe(`${SITE_URL}/report/gh/gh_abc123/abc%20def`)
  })
})

describe('ciReposForWorkspace', () => {
  test("returns only repos registered under the workspace's own active api keys", async () => {
    stub = {
      apiKeys: [
        { id: 'key-a', workspace_id: 'ws-1', revoked_at: null },
        { id: 'key-b', workspace_id: 'ws-2', revoked_at: null },
      ],
      ciRepos: [
        { id: 'repo-1', slug: 'gh_aaa', owner_repo: 'acme/one', api_key_id: 'key-a' },
        // Registered under a DIFFERENT workspace's key — must never leak into ws-1.
        { id: 'repo-2', slug: 'gh_bbb', owner_repo: 'acme/two', api_key_id: 'key-b' },
      ],
      ciReports: [
        {
          repo_id: 'repo-1',
          branch: 'main',
          commit_sha: 'abc1234',
          score: 91,
          grade: 'excellent',
          created_at: '2026-07-01T00:00:00.000Z',
        },
      ],
    }

    const result = await ciReposForWorkspace('ws-1')

    expect(result).toHaveLength(1)
    expect(result[0]?.slug).toBe('gh_aaa')
    expect(result[0]?.latestReport?.score).toBe(91)
  })

  test('excludes repos registered under a revoked key', async () => {
    stub = {
      apiKeys: [
        { id: 'key-revoked', workspace_id: 'ws-1', revoked_at: '2026-01-01T00:00:00.000Z' },
      ],
      ciRepos: [
        { id: 'repo-1', slug: 'gh_aaa', owner_repo: 'acme/one', api_key_id: 'key-revoked' },
      ],
      ciReports: [],
    }

    const result = await ciReposForWorkspace('ws-1')

    expect(result).toHaveLength(0)
  })

  test('returns a null latestReport for a repo registered but never reported', async () => {
    stub = {
      apiKeys: [{ id: 'key-a', workspace_id: 'ws-1', revoked_at: null }],
      ciRepos: [{ id: 'repo-1', slug: 'gh_aaa', owner_repo: 'acme/one', api_key_id: 'key-a' }],
      ciReports: [],
    }

    const result = await ciReposForWorkspace('ws-1')

    expect(result).toHaveLength(1)
    expect(result[0]?.latestReport).toBeNull()
  })

  test('returns the most recent report across branches', async () => {
    stub = {
      apiKeys: [{ id: 'key-a', workspace_id: 'ws-1', revoked_at: null }],
      ciRepos: [{ id: 'repo-1', slug: 'gh_aaa', owner_repo: 'acme/one', api_key_id: 'key-a' }],
      ciReports: [
        {
          repo_id: 'repo-1',
          branch: 'main',
          commit_sha: 'older12',
          score: 70,
          grade: 'moderate',
          created_at: '2026-06-01T00:00:00.000Z',
        },
        {
          repo_id: 'repo-1',
          branch: 'feature-x',
          commit_sha: 'newer12',
          score: 95,
          grade: 'excellent',
          created_at: '2026-07-01T00:00:00.000Z',
        },
      ],
    }

    const result = await ciReposForWorkspace('ws-1')

    expect(result[0]?.latestReport?.branch).toBe('feature-x')
    expect(result[0]?.latestReport?.commit).toBe('newer12')
  })

  test('returns an empty list when the workspace has no active api keys', async () => {
    stub = { apiKeys: [], ciRepos: [], ciReports: [] }

    const result = await ciReposForWorkspace('ws-1')

    expect(result).toEqual([])
  })
})
