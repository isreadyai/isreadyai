import { describe, expect, test } from 'bun:test'
import { toJsonb } from './jsonb'

describe('toJsonb', () => {
  test('removes null bytes from nested strings before jsonb persistence', () => {
    const value = toJsonb({
      evidence: {
        bodyPreview: 'gzip\u0000payload',
        nested: ['ok', '\u0000bad\u0000'],
      },
    })

    expect(value).toEqual({
      evidence: {
        bodyPreview: 'gzippayload',
        nested: ['ok', 'bad'],
      },
    })
    expect(JSON.stringify(value)).not.toContain('\\u0000')
  })

  test('normalizes unsupported JSON values the way JSON serialization would', () => {
    const value = toJsonb({
      finite: 1,
      nan: Number.NaN,
      array: [undefined, Number.POSITIVE_INFINITY],
      omitted: undefined,
    })

    expect(value).toEqual({
      finite: 1,
      nan: null,
      array: [null, null],
    })
  })
})
