import { afterEach, describe, expect, test } from 'bun:test'
import { signProxyToken, verifyProxyToken } from '@/lib/proxy-token'

// MARK: - Proxy token signing / verification

const ENV = {
  secret: process.env.PROXY_TOKEN_SECRET,
  vercel: process.env.VERCEL_ENV,
}

function setEnv(secret: string | undefined, vercelEnv: string | undefined): void {
  if (secret === undefined) {
    delete process.env.PROXY_TOKEN_SECRET
  } else {
    process.env.PROXY_TOKEN_SECRET = secret
  }
  if (vercelEnv === undefined) {
    delete process.env.VERCEL_ENV
  } else {
    process.env.VERCEL_ENV = vercelEnv
  }
}

afterEach(() => {
  process.env.PROXY_TOKEN_SECRET = ENV.secret
  process.env.VERCEL_ENV = ENV.vercel
})

const DEFAULT = 'dev-proxy-token-secret-change-in-production'

describe('proxy token', () => {
  test('host-bound round-trip with a real secret', () => {
    setEnv('a-real-strong-secret', undefined)
    const token = signProxyToken('Example.com')
    expect(verifyProxyToken(token, 'example.com')).toBe(true)
    expect(verifyProxyToken(token, 'www.example.com')).toBe(true)
    expect(verifyProxyToken(token, 'evil.com')).toBe(false)
  })

  test('the shipped default secret is rejected in production (fail closed)', () => {
    setEnv(DEFAULT, 'production')
    expect(() => signProxyToken('example.com')).toThrow()
    expect(verifyProxyToken('anything', 'example.com')).toBe(false)
  })

  test('the default secret still works outside production (dev convenience)', () => {
    setEnv(DEFAULT, 'preview')
    const token = signProxyToken('example.com')
    expect(verifyProxyToken(token, 'example.com')).toBe(true)
  })

  test('a missing secret fails closed everywhere', () => {
    setEnv(undefined, undefined)
    expect(() => signProxyToken('example.com')).toThrow()
    expect(verifyProxyToken('anything', 'example.com')).toBe(false)
  })
})
