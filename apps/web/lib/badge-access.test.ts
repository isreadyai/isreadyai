import { describe, expect, test } from 'bun:test'
import { badgeMarkdown, createBadgeToken, verifyBadgeToken } from './badge-access'

const SECRET = 'badge-signing-secret-at-least-32-characters'
const API_KEY_ID = 'key-123'

describe('badge access tokens', () => {
  test('creates a deterministic token bound to the domain', () => {
    const token = createBadgeToken('example.com', API_KEY_ID, SECRET)

    expect(token).toBe(createBadgeToken('example.com', API_KEY_ID, SECRET))
    expect(verifyBadgeToken('example.com', token, SECRET)).toEqual({ apiKeyId: API_KEY_ID })
    expect(verifyBadgeToken('another.example', token, SECRET)).toBeNull()
  })

  test('normalizes domain casing and a trailing dot', () => {
    const token = createBadgeToken('Example.COM.', API_KEY_ID, SECRET)

    expect(verifyBadgeToken('example.com', token, SECRET)).toEqual({ apiKeyId: API_KEY_ID })
  })

  test('binds the token to the issuing API key', () => {
    const first = createBadgeToken('example.com', API_KEY_ID, SECRET)
    const second = createBadgeToken('example.com', 'key-456', SECRET)

    expect(first).not.toBe(second)
    expect(verifyBadgeToken('example.com', second, SECRET)).toEqual({ apiKeyId: 'key-456' })
  })

  test('rejects altered tokens and invalid secrets', () => {
    const token = createBadgeToken('example.com', API_KEY_ID, SECRET)

    expect(verifyBadgeToken('example.com', `${token}x`, SECRET)).toBeNull()
    expect(verifyBadgeToken('example.com', token, 'too-short')).toBeNull()
    expect(() => createBadgeToken('example.com', API_KEY_ID, 'too-short')).toThrow()
  })
})

describe('badgeMarkdown', () => {
  test('embeds a host-bound token that verifies back to the key', () => {
    const markdown = badgeMarkdown('example.com', API_KEY_ID, SECRET)

    const match = markdown.match(/\/badge\/([^?]+)\?token=([^)]+)\)/)
    const encodedHost = match?.[1] ?? ''
    const encodedToken = match?.[2] ?? ''
    expect(decodeURIComponent(encodedHost)).toBe('example.com')

    const token = decodeURIComponent(encodedToken)
    expect(verifyBadgeToken('example.com', token, SECRET)).toEqual({ apiKeyId: API_KEY_ID })
  })
})
