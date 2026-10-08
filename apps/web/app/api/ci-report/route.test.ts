import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { IScanReport } from '@isreadyai/scanner'
import { EPlan } from '@/lib/plans'

// MARK: - POST /api/ci-report test setup
//
// API-key, OIDC and persistence boundaries are mocked at the factory so the route
// can be exercised without a live database. All are restored in afterAll so the
// mocks never leak into sibling suites.

let persistInputs: Array<Record<string, unknown>>

const realApiKeys = await import('@/lib/api-keys')
const realGithubOidc = await import('@/lib/github-oidc')
const realCiReports = await import('@/lib/ci-reports')

mock.module('@/lib/api-keys', () => ({
  ...realApiKeys,
  verifyApiKey: () =>
    Promise.resolve({ id: 'key-1', plan: EPlan.PRO, workspace_id: null as string | null }),
  apiKeyOwnerId: () => Promise.resolve('user-1'),
}))

mock.module('@/lib/github-oidc', () => ({
  ...realGithubOidc,
  verifyGithubRepoOidc: () => Promise.resolve({ repositoryId: '123', ownerRepo: 'octo/real' }),
}))

mock.module('@/lib/ci-reports', () => ({
  ...realCiReports,
  persistCiReport: (input: Record<string, unknown>) => {
    persistInputs.push(input)
    return Promise.resolve({
      slug: 'gh_test',
      branch: 'main',
      commit: 'abc123',
      score: 80,
      grade: 'good',
      linkedWebsite: false,
    })
  },
}))

const { POST } = await import('./route')

afterAll(() => {
  mock.module('@/lib/api-keys', () => realApiKeys)
  mock.module('@/lib/github-oidc', () => realGithubOidc)
  mock.module('@/lib/ci-reports', () => realCiReports)
})

beforeEach(() => {
  persistInputs = []
})

/** Minimal report that passes isScanReport, targeting `url`. */
function reportFor(url: string): IScanReport {
  return {
    url,
    finalUrl: url,
    scoreVersion: '1',
    overall: 80,
    grade: 'good',
    categories: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    checks: [],
    meta: { durationMs: 100, fetchOk: true },
  } as unknown as IScanReport
}

describe('POST /api/ci-report', () => {
  test('persists the OIDC-verified owner/repo, not the uploaded one', async () => {
    const res = await POST(
      new Request('https://isready.ai/api/ci-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-key',
          'x-github-oidc': 'oidc-token',
        },
        body: JSON.stringify({
          repositoryId: '123',
          ownerRepo: 'evil/spoof',
          branch: 'main',
          commit: 'abc123',
          url: 'https://example.com/',
          report: reportFor('https://example.com/'),
        }),
      }),
    )

    expect(res.status).toBe(200)
    expect(persistInputs).toHaveLength(1)
    expect(persistInputs[0]?.ownerRepo).toBe('octo/real')
    expect(persistInputs[0]?.repositoryId).toBe('123')
  })
})
