import { describe, expect, test } from 'bun:test'
import {
  CATEGORY_WEIGHTS,
  aiSearchTrackScore,
  gradeOf,
  overallScore,
  readinessHeadlineScore,
  scoreCategories,
} from './score.ts'
import type { ICategoryScore, ICheckResult, TCategory } from './types.ts'
import { CATEGORY_LABELS, ECategory, EGrade, EStatus } from './types.ts'

// MARK: - Fixtures

function check(category: TCategory, score: number, weight: number): ICheckResult {
  return {
    id: 'check',
    category,
    status: EStatus.PASS,
    score,
    weight,
    title: 'title',
    detail: 'detail',
  }
}

function cat(category: TCategory, score: number, weight: number): ICategoryScore {
  return { category, label: CATEGORY_LABELS[category], score, weight, checks: [] }
}

const ALL_CATEGORIES = Object.values(ECategory)

// MARK: - scoreCategories

describe('scoreCategories', () => {
  test('returns one entry per category in enum order', () => {
    const scores = scoreCategories([])
    expect(scores.map((s) => s.category)).toEqual(ALL_CATEGORIES)
  })

  test('empty input scores every category at 100 (no checks -> weighted 1)', () => {
    for (const s of scoreCategories([])) {
      expect(s.score).toBe(100)
      expect(s.checks).toEqual([])
      expect(s.weight).toBe(CATEGORY_WEIGHTS[s.category])
      expect(s.label).toBe(CATEGORY_LABELS[s.category])
    }
  })

  test('averages checks weighted by their own weight within a category', () => {
    const scores = scoreCategories([
      check(ECategory.CRAWLER_ACCESS, 1, 1),
      check(ECategory.CRAWLER_ACCESS, 0, 1),
    ])
    const crawler = scores.find((s) => s.category === ECategory.CRAWLER_ACCESS)
    // (1*1 + 0*1) / 2 = 0.5 -> 50
    expect(crawler?.score).toBe(50)
    // Other categories stay at the empty-default of 100.
    const rendering = scores.find((s) => s.category === ECategory.RENDERING)
    expect(rendering?.score).toBe(100)
  })

  test('respects per-check weights (not a plain mean)', () => {
    const scores = scoreCategories([
      check(ECategory.STRUCTURED_DATA, 1, 3),
      check(ECategory.STRUCTURED_DATA, 0, 1),
    ])
    const sd = scores.find((s) => s.category === ECategory.STRUCTURED_DATA)
    // (1*3 + 0*1) / 4 = 0.75 -> 75
    expect(sd?.score).toBe(75)
  })

  test('rounds the category score to the nearest integer', () => {
    const scores = scoreCategories([check(ECategory.TRUST, 0.876, 1)])
    const trust = scores.find((s) => s.category === ECategory.TRUST)
    // 0.876 * 100 = 87.6 -> 88
    expect(trust?.score).toBe(88)
  })

  test('rounds half up', () => {
    const scores = scoreCategories([check(ECategory.TRUST, 0.005, 1)])
    const trust = scores.find((s) => s.category === ECategory.TRUST)
    // 0.005 * 100 = 0.5 -> 1
    expect(trust?.score).toBe(1)
  })

  test('checks whose weights sum to zero fall back to 100 (totalWeight === 0 branch)', () => {
    const scores = scoreCategories([
      check(ECategory.GEO_CONTENT, 0, 0),
      check(ECategory.GEO_CONTENT, 0, 0),
    ])
    const geo = scores.find((s) => s.category === ECategory.GEO_CONTENT)
    // totalWeight 0 -> weighted defaults to 1 -> 100, even though check scores are 0.
    expect(geo?.score).toBe(100)
    expect(geo?.checks).toHaveLength(2)
  })

  test('a perfect-and-zero split clamps within 0..100 via the weighted mean', () => {
    const scores = scoreCategories([
      check(ECategory.RENDERING, 1, 1),
      check(ECategory.RENDERING, 1, 1),
    ])
    const rendering = scores.find((s) => s.category === ECategory.RENDERING)
    expect(rendering?.score).toBe(100)
  })
})

// MARK: - overallScore

describe('overallScore', () => {
  test('empty categories array returns 0', () => {
    expect(overallScore([])).toBe(0)
  })

  test('all-100 categories yield 100', () => {
    expect(overallScore(scoreCategories([]))).toBe(100)
  })

  test('combines category scores weighted by category weight', () => {
    const result = overallScore([
      cat(ECategory.CRAWLER_ACCESS, 100, 0.5),
      cat(ECategory.RENDERING, 0, 0.5),
    ])
    // (100*0.5 + 0*0.5) / 1 = 50
    expect(result).toBe(50)
  })

  test('rounds the overall to the nearest integer', () => {
    const result = overallScore([
      cat(ECategory.CRAWLER_ACCESS, 80, 1),
      cat(ECategory.RENDERING, 81, 1),
      cat(ECategory.TRUST, 81, 1),
    ])
    // (80 + 81 + 81) / 3 = 80.666... -> 81
    expect(result).toBe(81)
  })

  test('zero total weight returns 0 even with non-zero scores', () => {
    expect(overallScore([cat(ECategory.CRAWLER_ACCESS, 100, 0)])).toBe(0)
  })
})

// MARK: - readiness headline

describe('aiSearchTrackScore', () => {
  test('uses the single-page base when no deep scan ran', () => {
    expect(aiSearchTrackScore({ base: 92 })).toBe(92)
  })

  test('uses the site-wide deep score over base', () => {
    expect(aiSearchTrackScore({ base: 92, deep: 45 })).toBe(45)
  })
})

describe('readinessHeadlineScore', () => {
  test('uses AI Search alone when Smart Agent did not run', () => {
    expect(readinessHeadlineScore({ base: 92, deep: 45 })).toBe(45)
  })

  test('averages AI Search and Smart Agent when Smart Agent ran', () => {
    expect(readinessHeadlineScore({ base: 92, deep: 45, smart: 94 })).toBe(70)
  })

  test('averages base and Smart Agent when no deep scan ran', () => {
    expect(readinessHeadlineScore({ base: 92, smart: 80 })).toBe(86)
  })
})

// MARK: - gradeOf

describe('gradeOf', () => {
  test('grade boundaries are inclusive on the lower bound', () => {
    expect(gradeOf(90)).toBe(EGrade.EXCELLENT)
    expect(gradeOf(89)).toBe(EGrade.GOOD)
    expect(gradeOf(75)).toBe(EGrade.GOOD)
    expect(gradeOf(74)).toBe(EGrade.MODERATE)
    expect(gradeOf(50)).toBe(EGrade.MODERATE)
    expect(gradeOf(49)).toBe(EGrade.POOR)
    expect(gradeOf(0)).toBe(EGrade.POOR)
  })

  test('handles out-of-range values without clamping', () => {
    expect(gradeOf(100)).toBe(EGrade.EXCELLENT)
    expect(gradeOf(150)).toBe(EGrade.EXCELLENT)
    expect(gradeOf(-5)).toBe(EGrade.POOR)
  })
})
