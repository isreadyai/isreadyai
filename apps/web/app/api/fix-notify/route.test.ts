import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { EPlan } from '@/lib/plans'

// MARK: - POST /api/fix-notify plan-gate test setup
//
// `verifyApiKey` / `consumeRateLimit` are mocked at the factory boundary so the
// premium gate can be exercised without a live database. Both are restored in
// afterAll so the mock never leaks into sibling suites.

let keyResult: { id: string; plan: (typeof EPlan)[keyof typeof EPlan] } | null
let rateLimitAllowed: boolean

const realApiKeys = await import('@/lib/api-keys')
const realRateLimit = await import('@/lib/rate-limit')

mock.module('@/lib/api-keys', () => ({
  ...realApiKeys,
  verifyApiKey: () => Promise.resolve(keyResult),
}))

mock.module('@/lib/rate-limit', () => ({
  ...realRateLimit,
  consumeRateLimit: () => Promise.resolve(rateLimitAllowed),
}))

const { POST, parseFixNotify, recordFixRunOutcome } = await import('./route')

afterAll(() => {
  mock.module('@/lib/api-keys', () => realApiKeys)
  mock.module('@/lib/rate-limit', () => realRateLimit)
})

beforeEach(() => {
  keyResult = { id: 'key-1', plan: EPlan.PRO }
  rateLimitAllowed = true
})

function notifyRequest(body: unknown): Request {
  return new Request('https://isready.ai/api/fix-notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-key' },
    body: JSON.stringify(body),
  })
}

describe('parseFixNotify', () => {
  const valid = { repo: 'owner/repo', prUrl: 'https://github.com/owner/repo/pull/3', patches: 2 }

  test('accepts a well-formed github pull-request payload', () => {
    expect(parseFixNotify(valid).ok).toBe(true)
  })

  test('rejects a prUrl that is not an https github.com url', () => {
    expect(parseFixNotify({ ...valid, prUrl: 'https://evil.com/owner/repo/pull/3' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, prUrl: 'http://github.com/owner/repo/pull/3' }).ok).toBe(
      false,
    )
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com.evil.com/x' }).ok).toBe(false)
  })

  test('rejects a prUrl that is not a PR path', () => {
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com/owner/repo' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com/owner/repo/issues/3' }).ok).toBe(
      false,
    )
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com/owner/repo/pull/abc' }).ok).toBe(
      false,
    )
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com/owner/repo/pull/0' }).ok).toBe(
      false,
    )
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com/owner/repo/pull/01' }).ok).toBe(
      false,
    )
  })

  test('rejects a prUrl carrying credentials, a non-default port, a query or a fragment', () => {
    expect(
      parseFixNotify({ ...valid, prUrl: 'https://user:pass@github.com/owner/repo/pull/3' }).ok,
    ).toBe(false)
    expect(
      parseFixNotify({ ...valid, prUrl: 'https://github.com:8443/owner/repo/pull/3' }).ok,
    ).toBe(false)
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com/owner/repo/pull/3?x=1' }).ok).toBe(
      false,
    )
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com/owner/repo/pull/3#x' }).ok).toBe(
      false,
    )
  })

  test('rejects a repo that is not a bare owner/repo slug', () => {
    expect(parseFixNotify({ ...valid, repo: 'no-slash' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, repo: 'owner/repo/extra' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, repo: 'owner/repo with space' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, repo: '<script>/repo' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, repo: '/repo' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, repo: 'owner/' }).ok).toBe(false)
  })

  test('rejects missing or malformed fields', () => {
    expect(parseFixNotify({ ...valid, repo: '' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, prUrl: 'not-a-url' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, patches: -1 }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, patches: 1.5 }).ok).toBe(false)
    expect(parseFixNotify(null).ok).toBe(false)
  })
})

describe('recordFixRunOutcome', () => {
  interface IStubState {
    eqs: Record<string, unknown>
    updated: { patches: number; url: string } | null
    updatedId: string | null
    mintRow: { id: string } | null
  }

  function stubClient(state: IStubState) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the query builder
    const selectProxy: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'maybeSingle') {
          return () => Promise.resolve({ data: state.mintRow, error: null })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chainable filter args
        return (...args: any[]) => {
          if (prop === 'eq') {
            state.eqs[args[0]] = args[1]
          }
          return selectProxy
        }
      },
    })
    return {
      from: () => ({
        select: () => selectProxy,
        update: (values: { patches: number; url: string }) => ({
          eq: (_column: string, id: string) => {
            state.updated = values
            state.updatedId = id
            return Promise.resolve({ error: null })
          },
        }),
      }),
    } as unknown as Parameters<typeof recordFixRunOutcome>[0]
  }

  const data = {
    repo: 'acme/site',
    prUrl: 'https://github.com/acme/site/pull/7',
    patches: 3,
  }

  test('writes patches and the PR url onto the reserved mint row', async () => {
    const state: IStubState = { eqs: {}, updated: null, updatedId: null, mintRow: { id: 'run-1' } }
    await recordFixRunOutcome(stubClient(state), 'key-1', data)
    expect(state.eqs).toMatchObject({
      api_key_id: 'key-1',
      repo: 'acme/site',
      kind: 'solve',
      patches: 0,
    })
    expect(state.updated).toEqual({ patches: 3, url: 'https://github.com/acme/site/pull/7' })
    expect(state.updatedId).toBe('run-1')
  })

  test('is a no-op when no unrecorded mint row exists', async () => {
    const state: IStubState = { eqs: {}, updated: null, updatedId: null, mintRow: null }
    await recordFixRunOutcome(stubClient(state), 'key-1', data)
    expect(state.updated).toBeNull()
  })
})

describe('POST /api/fix-notify premium gate', () => {
  const body = { repo: 'owner/repo', prUrl: 'https://github.com/owner/repo/pull/3', patches: 1 }

  test('rejects a free-plan key with 403 premium_required', async () => {
    keyResult = { id: 'key-1', plan: EPlan.FREE }

    const res = await POST(notifyRequest(body))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'premium_required',
      upgrade: 'https://isready.ai/#pricing',
    })
  })

  test('lets a pro-plan key past the gate (reaches rate limiting)', async () => {
    keyResult = { id: 'key-1', plan: EPlan.PRO }
    rateLimitAllowed = false

    const res = await POST(notifyRequest(body))

    // Proven to be past the premium gate because it now fails on the NEXT
    // check (rate limiting) instead of 403.
    expect(res.status).toBe(429)
  })
})
