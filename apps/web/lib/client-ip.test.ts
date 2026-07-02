import { afterEach, describe, expect, test } from 'bun:test'
import { clientIp } from '@/lib/client-ip'

// MARK: - clientIp trusted-source extraction

function req(headers: Record<string, string>): Request {
  return new Request('https://isready.ai/api/x', { headers })
}

// Trusted by default; tests that flip TRUST_PROXY_HEADERS clear it afterwards.
afterEach(() => {
  delete process.env.TRUST_PROXY_HEADERS
})

describe('clientIp', () => {
  test('prefers the platform-set x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '5.5.5.5', 'x-forwarded-for': '9.9.9.9, 5.5.5.5' }))).toBe(
      '5.5.5.5',
    )
  })

  test('uses the RIGHTMOST forwarded hop, not the spoofable leftmost', () => {
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 5.5.5.5' }))).toBe('5.5.5.5')
  })

  test('a single forwarded value is used as-is', () => {
    expect(clientIp(req({ 'x-forwarded-for': '5.5.5.5' }))).toBe('5.5.5.5')
  })

  test('falls back to the shared local bucket without trusted headers', () => {
    expect(clientIp(req({}))).toBe('local')
    expect(clientIp(req({ 'x-forwarded-for': ' , ' }))).toBe('local')
  })

  test('ignores spoofable headers when the proxy is untrusted (TRUST_PROXY_HEADERS=false)', () => {
    process.env.TRUST_PROXY_HEADERS = 'false'
    expect(clientIp(req({ 'x-real-ip': '5.5.5.5', 'x-forwarded-for': '9.9.9.9, 5.5.5.5' }))).toBe(
      'local',
    )
  })

  test("'0' also opts out of trusting forwarded headers", () => {
    process.env.TRUST_PROXY_HEADERS = '0'
    expect(clientIp(req({ 'x-real-ip': '5.5.5.5' }))).toBe('local')
  })

  test('any other value keeps headers trusted (Vercel default)', () => {
    process.env.TRUST_PROXY_HEADERS = 'true'
    expect(clientIp(req({ 'x-real-ip': '5.5.5.5' }))).toBe('5.5.5.5')
  })
})
