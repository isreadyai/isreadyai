import { describe, expect, test } from 'bun:test'
import { POST } from '@/app/api/proxy/route'

// MARK: - /api/proxy same-site guard
//
// Only the cross-origin rejection paths are exercised here: isSameSite runs
// before any rate-limit / fetch, so these short-circuit to 403 without touching
// Supabase or the network.

function proxyRequest(headers: Record<string, string>): Request {
  return new Request('https://isready.ai/api/proxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ url: 'https://example.com' }),
  })
}

describe('POST /api/proxy origin guard', () => {
  test('rejects a look-alike localhost host (the startsWith bypass)', async () => {
    const res = await POST(proxyRequest({ origin: 'http://localhost.evil.tld' }))
    expect(res.status).toBe(403)
  })

  test('rejects a look-alike localhost in the Referer', async () => {
    const res = await POST(proxyRequest({ referer: 'http://localhost.evil.tld/x' }))
    expect(res.status).toBe(403)
  })

  test('rejects an external origin', async () => {
    const res = await POST(proxyRequest({ origin: 'https://evil.tld' }))
    expect(res.status).toBe(403)
  })

  test('rejects a request with no Origin or Referer (e.g. curl)', async () => {
    const res = await POST(proxyRequest({}))
    expect(res.status).toBe(403)
  })
})
