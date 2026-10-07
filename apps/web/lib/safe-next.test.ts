import { describe, expect, test } from 'bun:test'
import { safeNext } from '@/lib/safe-next'

// MARK: - safeNext open-redirect guard

describe('safeNext', () => {
  test('keeps a same-site absolute path (with query and fragment)', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard')
    expect(safeNext('/checkout?plan=pro')).toBe('/checkout?plan=pro')
    expect(safeNext('/a/b#c')).toBe('/a/b#c')
  })

  test('rejects protocol-relative and backslash hosts', () => {
    expect(safeNext('//evil.tld')).toBe('/dashboard')
    expect(safeNext('//evil.tld/path')).toBe('/dashboard')
    expect(safeNext('/\\evil.tld')).toBe('/dashboard')
  })

  test('rejects control characters, backslashes and decoded tabs', () => {
    expect(safeNext('/\t/evil.tld')).toBe('/dashboard')
    expect(safeNext('/\n/evil.tld')).toBe('/dashboard')
    expect(safeNext('/\r/evil.tld')).toBe('/dashboard')
    expect(safeNext('/\t\\evil.tld')).toBe('/dashboard')
    expect(safeNext('/ok\\path')).toBe('/dashboard')
    expect(safeNext('/a\u007f/b')).toBe('/dashboard')
    expect(safeNext(new URLSearchParams('next=/%09/evil.tld').get('next'))).toBe('/dashboard')
  })

  test('rejects absolute and scheme URLs', () => {
    expect(safeNext('https://evil.tld')).toBe('/dashboard')
    expect(safeNext('http://localhost.evil.tld')).toBe('/dashboard')
    expect(safeNext('javascript:alert(1)')).toBe('/dashboard')
  })

  test('rejects relative paths and empty input', () => {
    expect(safeNext('dashboard')).toBe('/dashboard')
    expect(safeNext('')).toBe('/dashboard')
    expect(safeNext(null)).toBe('/dashboard')
    expect(safeNext(undefined)).toBe('/dashboard')
  })
})
