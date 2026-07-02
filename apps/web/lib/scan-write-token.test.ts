import { afterEach, describe, expect, test } from 'bun:test'
import { signScanWriteToken, verifyScanWriteToken } from '@/lib/scan-write-token'

// MARK: - Scan write token

const ENV = process.env.PROXY_TOKEN_SECRET

afterEach(() => {
  if (ENV === undefined) {
    delete process.env.PROXY_TOKEN_SECRET
  } else {
    process.env.PROXY_TOKEN_SECRET = ENV
  }
})

describe('scan write token', () => {
  test('round-trips for the same scan id', () => {
    process.env.PROXY_TOKEN_SECRET = 'a-secret'
    const token = signScanWriteToken('scan-1')
    expect(verifyScanWriteToken(token, 'scan-1')).toBe(true)
  })

  test('rejects a token bound to a different scan', () => {
    process.env.PROXY_TOKEN_SECRET = 'a-secret'
    const token = signScanWriteToken('scan-1')
    expect(verifyScanWriteToken(token, 'scan-2')).toBe(false)
  })

  test('rejects a malformed or empty token', () => {
    process.env.PROXY_TOKEN_SECRET = 'a-secret'
    expect(verifyScanWriteToken('garbage', 'scan-1')).toBe(false)
    expect(verifyScanWriteToken('', 'scan-1')).toBe(false)
  })

  test('fails closed without a secret', () => {
    delete process.env.PROXY_TOKEN_SECRET
    expect(verifyScanWriteToken('1.2', 'scan-1')).toBe(false)
    expect(() => signScanWriteToken('scan-1')).toThrow()
  })
})
