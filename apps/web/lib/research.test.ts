import { describe, expect, test } from 'bun:test'
import { ECategory, ECheckScope, type ICheck } from '@isreadyai/scanner'
import type { ICorpusCheckCounts } from '@/lib/scan-corpus'
import { RESEARCH_MIN_CHECK_SITES, topGaps } from './research'

function check(id: string, weight = 1): ICheck {
  return {
    id,
    category: ECategory.CRAWLER_ACCESS,
    weight,
    title: `Title ${id}`,
    scope: ECheckScope.SITE,
    run: () => {
      throw new Error('not run in tests')
    },
  }
}

function counts(id: string, sites: number, fail: number, warn = 0): ICorpusCheckCounts {
  return { id, sites, fail, warn }
}

const registry = [check('a'), check('b'), check('c'), check('zero', 0)]

describe('topGaps', () => {
  test('drops checks below the minimum sample', () => {
    const rows = [
      counts('a', RESEARCH_MIN_CHECK_SITES - 1, 10),
      counts('b', RESEARCH_MIN_CHECK_SITES, 10),
    ]
    expect(topGaps(rows, registry).map((gap) => gap.id)).toEqual(['b'])
  })

  test('skips ids missing from the registry', () => {
    expect(topGaps([counts('unknown', 100, 90), counts('a', 100, 10)], registry)).toHaveLength(1)
  })

  test('skips zero-weight checks', () => {
    expect(topGaps([counts('zero', 100, 90)], registry)).toEqual([])
  })

  test('sorts by share descending, then id, and adds fail and warn', () => {
    const gaps = topGaps(
      [counts('c', 100, 20, 10), counts('b', 100, 30), counts('a', 100, 30), counts('d', 100, 5)],
      [...registry, check('d')],
    )
    expect(gaps.map((gap) => gap.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(gaps[2]).toEqual({
      id: 'c',
      title: 'Title c',
      sites: 100,
      fail: 20,
      warn: 10,
      share: 0.3,
    })
  })

  test('applies the limit', () => {
    const rows = [counts('a', 100, 3), counts('b', 100, 2), counts('c', 100, 1)]
    expect(topGaps(rows, registry, 2).map((gap) => gap.id)).toEqual(['a', 'b'])
  })
})
