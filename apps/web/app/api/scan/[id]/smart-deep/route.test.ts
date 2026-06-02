import { describe, expect, test } from 'bun:test'
import { isScanAuthorized } from './route.ts'

describe('isScanAuthorized', () => {
  test('allows anonymous (public-by-id) scans', () => {
    expect(isScanAuthorized({ userId: null }, 'user-a')).toBe(true)
    expect(isScanAuthorized({ userId: null }, null)).toBe(true)
  })

  test('allows the owning caller', () => {
    expect(isScanAuthorized({ userId: 'user-a' }, 'user-a')).toBe(true)
  })

  test('rejects another account (IDOR)', () => {
    expect(isScanAuthorized({ userId: 'user-a' }, 'user-b')).toBe(false)
    expect(isScanAuthorized({ userId: 'user-a' }, null)).toBe(false)
  })

  test('rejects a missing scan', () => {
    expect(isScanAuthorized(null, 'user-a')).toBe(false)
  })
})
