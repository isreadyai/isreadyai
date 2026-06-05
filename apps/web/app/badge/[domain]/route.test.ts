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
})
