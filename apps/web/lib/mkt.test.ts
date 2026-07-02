import { describe, expect, test } from 'bun:test'
import { MKT_VARIANT_COUNT, parseMkt } from '@/lib/mkt'

describe('parseMkt', () => {
  test('accepts each in-range variant 1..N', () => {
    for (let i = 1; i <= MKT_VARIANT_COUNT; i++) {
      expect(parseMkt(String(i))).toBe(i)
    }
  })

  test('treats a missing param as the default (0)', () => {
    expect(parseMkt(undefined)).toBe(0)
  })

  test('treats an empty string as the default (0)', () => {
    expect(parseMkt('')).toBe(0)
  })

  test('treats 0 as the default (0)', () => {
    expect(parseMkt('0')).toBe(0)
  })

  test('rejects out-of-range values', () => {
    expect(parseMkt(String(MKT_VARIANT_COUNT + 1))).toBe(0)
    expect(parseMkt('99')).toBe(0)
    expect(parseMkt('-1')).toBe(0)
  })

  test('rejects non-numeric values', () => {
    expect(parseMkt('abc')).toBe(0)
    expect(parseMkt('1x')).toBe(0)
  })

  test('rejects non-integer values', () => {
    expect(parseMkt('2.5')).toBe(0)
  })

  test('uses the first value when the param is repeated (array)', () => {
    expect(parseMkt(['3', '4'])).toBe(3)
    expect(parseMkt(['bad', '2'])).toBe(0)
  })
})
