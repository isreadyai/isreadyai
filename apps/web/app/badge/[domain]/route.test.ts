import { afterEach, describe, expect, mock, test } from 'bun:test'

// The badge route is TOKENLESS: authorization is proven DNS ownership, surfaced
// by verifiedDomainBadgeScore (verified + premium + activated). Mock it so the
// route's branching is tested without a live DB and regardless of env config.
let scoreResult: { score: number | null; grade: string } | null = null
mock.module('@/lib/badge-score', () => ({
  verifiedDomainBadgeScore: (): Promise<typeof scoreResult> => Promise.resolve(scoreResult),
}))

const { GET } = await import('./route')

function call(domain: string): Promise<Response> {
  return GET(new Request(`https://isready.ai/badge/${encodeURIComponent(domain)}`), {
    params: Promise.resolve({ domain }),
  })
}

describe('badge route (tokenless)', () => {
  afterEach(() => {
    scoreResult = null
  })

  test('locked badge for an invalid host', async () => {
    const response = await call('localhost.svg')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('premium')
  })

  test('locked badge when the domain is not a verified premium site', async () => {
    scoreResult = null
    const response = await call('example.com.svg')
    expect(await response.text()).toContain('premium')
  })

  test('real badge for a verified premium domain', async () => {
    scoreResult = { score: 92, grade: 'excellent' }
    const response = await call('example.com.svg')
    const body = await response.text()
    expect(body).not.toContain('premium')
    expect(body).toContain('AI ready')
    expect(body).toContain('92')
  })

  // The locked badge is a TRANSIENT ineligible state: the moment the owner
  // verifies, upgrades and activates, the real score must appear. Serving it with
  // a day-long stale-while-revalidate made a now-eligible site keep showing the
  // locked "premium" badge for up to 24h (the reported deluisa.bio bug). It must
  // therefore carry a short TTL and a short revalidation window.
  test('locked badge is cached only briefly (no day-long stale window)', async () => {
    scoreResult = null
    const cacheControl = (await call('example.com.svg')).headers.get('cache-control') ?? ''
    expect(cacheControl).toContain('s-maxage=60')
    expect(cacheControl).toContain('stale-while-revalidate=60')
    expect(cacheControl).not.toContain('stale-while-revalidate=86400')
  })

  test('locked badge for an invalid host is also cached only briefly', async () => {
    const cacheControl = (await call('localhost.svg')).headers.get('cache-control') ?? ''
    expect(cacheControl).toContain('s-maxage=60')
    expect(cacheControl).not.toContain('stale-while-revalidate=86400')
  })

  test('a real score badge stays long-cached', async () => {
    scoreResult = { score: 92, grade: 'excellent' }
    const cacheControl = (await call('example.com.svg')).headers.get('cache-control') ?? ''
    expect(cacheControl).toContain('s-maxage=21600')
  })
})
