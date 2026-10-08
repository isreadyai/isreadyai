import { describe, expect, test } from 'bun:test'
import { CORPUS_MIN_SITES, summarizeCorpus, type ICorpusRow } from '@/lib/scan-corpus'

// MARK: - Fixtures

const UA = 'crawler.ua-blocking'

function row(host: string, overall: number, checks: unknown = [], minute = 0): ICorpusRow {
  return {
    host,
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 59 - minute)).toISOString(),
    overall,
    checks,
  }
}

function corpus(
  count: number,
  overall = 80,
  checks: unknown = [],
  prefix = 'site',
  score: (index: number) => number = () => overall,
): ICorpusRow[] {
  return Array.from({ length: count }, (_, i) => row(`${prefix}${i}.test`, score(i), checks, i))
}

// MARK: - summarizeCorpus

describe('summarizeCorpus', () => {
  test('returns null below the minimum site count', () => {
    expect(summarizeCorpus(corpus(CORPUS_MIN_SITES - 1))).toBeNull()
    expect(summarizeCorpus(corpus(CORPUS_MIN_SITES))?.sites).toBe(CORPUS_MIN_SITES)
  })

  test('keeps the newest row per host', () => {
    const rows = [row('a.test', 95), row('a.test', 10), ...corpus(CORPUS_MIN_SITES, 80)]
    const stats = summarizeCorpus(rows)
    expect(stats?.sites).toBe(CORPUS_MIN_SITES + 1)
    expect(stats?.grades.excellent).toBe(1)
    expect(stats?.grades.poor).toBe(0)
  })

  test('computes the median for odd and even counts', () => {
    const odd = corpus(CORPUS_MIN_SITES + 1, 0, [], 'site', (i) => i)
    expect(summarizeCorpus(odd)?.medianScore).toBe(15)
    const even = corpus(CORPUS_MIN_SITES, 0, [], 'site', (i) => i)
    expect(summarizeCorpus(even)?.medianScore).toBe(15)
    const gap = corpus(CORPUS_MIN_SITES, 0, [], 'site', (i) => (i < 15 ? 10 : 11))
    expect(summarizeCorpus(gap)?.medianScore).toBe(11)
  })

  test('counts sites per grade of the headline score', () => {
    const rows = [
      ...corpus(CORPUS_MIN_SITES, 95, [], 'e'),
      row('good.test', 75),
      row('moderate.test', 50),
      row('moderate2.test', 74),
      row('poor.test', 49),
    ]
    const stats = summarizeCorpus(rows)
    expect(stats?.grades).toEqual({
      excellent: CORPUS_MIN_SITES,
      good: 1,
      moderate: 2,
      poor: 1,
    })
  })

  test('counts refused user-agent responses and excludes info and missing entries', () => {
    const rows = [
      ...corpus(10, 80, [{ id: UA, status: 'pass' }]),
      ...corpus(5, 80, [{ id: UA, status: 'warn' }], 'w'),
      ...corpus(4, 80, [{ id: UA, status: 'fail' }], 'f'),
      ...corpus(6, 80, [{ id: UA, status: 'info' }], 'i'),
      ...corpus(8, 80, [{ id: 'other', status: 'fail' }], 'o'),
    ]
    const stats = summarizeCorpus(rows)
    expect(stats?.uaRefused).toEqual({ sites: 19, refused: 9 })
    expect(stats?.checks.find((c) => c.id === UA)).toEqual({ id: UA, sites: 19, fail: 4, warn: 5 })
    expect(stats?.checks.map((c) => c.id)).toEqual([UA, 'other'])
  })

  test('ignores malformed checks', () => {
    const malformed: unknown[] = [
      null,
      'text',
      { id: 5, status: 'fail' },
      { id: UA, status: 'bogus' },
      { id: UA },
      [],
    ]
    for (const checks of [malformed, 'nope', null, { id: UA, status: 'fail' }]) {
      const stats = summarizeCorpus(corpus(CORPUS_MIN_SITES, 80, checks))
      expect(stats?.checks).toEqual([])
      expect(stats?.uaRefused).toEqual({ sites: 0, refused: 0 })
    }
  })

  test('reports the oldest and newest included scan', () => {
    const stats = summarizeCorpus(corpus(CORPUS_MIN_SITES))
    expect(stats?.to).toBe(new Date(Date.UTC(2026, 9, 1, 12, 59)).toISOString())
    expect(stats?.from).toBe(
      new Date(Date.UTC(2026, 9, 1, 12, 59 - (CORPUS_MIN_SITES - 1))).toISOString(),
    )
  })
})
