import { describe, expect, test } from 'bun:test'
import { validateScanInput } from './url.ts'

describe('validateScanInput', () => {
  test.each([
    'smartsquad.io',
    'example.com',
    'sub.domain.co.uk',
    'https://example.com/path?q=1',
    'http://example.com',
    'a-b.example.io',
    'EXAMPLE.COM',
    '  example.com  ',
    'münchen.de', // IDN → punycode via URL()
    'xn--mnchen-3ya.de',
  ])('accepts %s', (input) => {
    const result = validateScanInput(input)
    expect(result.ok).toBe(true)
  })

  test.each([
    '',
    'foo',
    'foo.',
    '.com',
    '-bad.com',
    'bad-.com',
    'foo bar.com',
    'javascript:alert(1)',
    'ftp://example.com',
    'http://',
    'a.b', // TLD too short
  ])('rejects %s as invalid', (input) => {
    const result = validateScanInput(input)
    expect(result).toEqual({ ok: false, problem: 'invalid' })
  })

  test.each(['localhost', 'http://localhost:3000', '192.168.1.1', 'foo.local', 'api.internal'])(
    'rejects %s as private',
    (input) => {
      const result = validateScanInput(input)
      expect(result).toEqual({ ok: false, problem: 'private' })
    },
  )

  test('normalizes to a full URL', () => {
    const result = validateScanInput('smartsquad.io')
    expect(result).toEqual({ ok: true, url: 'https://smartsquad.io/' })
  })
})
