import type { ICategoryScore, ICheckResult, TCategory, TGrade } from './types.ts'
import { CATEGORY_LABELS, ECategory, EGrade } from './types.ts'

/**
 * Scoring engine: computes category and overall audit scores from check results
 * using versioned methodology and category weights reflecting AI visibility impact.
 */

// MARK: - Scoring

/**
 * Current scoring methodology version.
 *
 * Bumped when category weights or calculation logic changes to allow
 * re-grading historical scans. Included in every report.
 *
 * @export
 */
export const SCORE_VERSION = '2026.06.2'

/**
 * Category weight distribution: influence of each audit dimension on overall score.
 *
 * Weights reflect measured impact on AI crawler visibility and indexing.
 *
 * @export
 */
export const CATEGORY_WEIGHTS: Record<TCategory, number> = {
  [ECategory.CRAWLER_ACCESS]: 0.25,
  [ECategory.RENDERING]: 0.2,
  [ECategory.STRUCTURED_DATA]: 0.3,
  [ECategory.TRUST]: 0.1,
  [ECategory.GEO_CONTENT]: 0.15,
}

export interface IReadinessScoreTracks {
  base: number
  deep?: number | null
  smart?: number | null
}

/**
 * AI Search track: site-wide deep score when present, otherwise the single-page base.
 */
export function aiSearchTrackScore(tracks: IReadinessScoreTracks): number {
  return typeof tracks.deep === 'number' ? tracks.deep : tracks.base
}

/**
 * Headline readiness score. Deep and base are the same AI Search track at
 * different breadth, so deep wins over base. Smart Agent is a separate track
 * and is averaged in only when it has actually run.
 */
export function readinessHeadlineScore(tracks: IReadinessScoreTracks): number {
  const search = aiSearchTrackScore(tracks)
  if (typeof tracks.smart === 'number') {
    return Math.round((search + tracks.smart) / 2)
  }
  return search
}

/**
 * Computes category scores from check results: weighted average per category.
 *
 * @param {ICheckResult[]} checks - The check results to score.
 * @returns {ICategoryScore[]} - Category scores in canonical order.
 * @export
 */
export function scoreCategories(checks: ICheckResult[]): ICategoryScore[] {
  const order = Object.values(ECategory)
  return order.map((category) => {
    const inCategory = checks.filter((c) => c.category === category)
    const totalWeight = inCategory.reduce((sum, c) => sum + c.weight, 0)
    const weighted =
      totalWeight > 0 ? inCategory.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight : 1
    return {
      category,
      label: CATEGORY_LABELS[category],
      score: Math.round(weighted * 100),
      weight: CATEGORY_WEIGHTS[category],
      checks: inCategory,
    }
  })
}

/**
 * Computes overall audit score: weighted average of category scores.
 *
 * @param {ICategoryScore[]} categories - The category scores to aggregate.
 * @returns {number} - Overall score 0–100.
 * @export
 */
export function overallScore(categories: ICategoryScore[]): number {
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0)
  if (totalWeight === 0) {
    return 0
  }
  const weighted = categories.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
  return Math.round(weighted)
}

/**
 * Maps an overall score to a grade letter: Excellent (90+), Good (75+), Moderate (50+), or Poor.
 *
 * @param {number} overall - The overall score (0–100).
 * @returns {TGrade} - The corresponding grade.
 * @export
 */
export function gradeOf(overall: number): TGrade {
  if (overall >= 90) {
    return EGrade.EXCELLENT
  }
  if (overall >= 75) {
    return EGrade.GOOD
  }
  if (overall >= 50) {
    return EGrade.MODERATE
  }
  return EGrade.POOR
}
