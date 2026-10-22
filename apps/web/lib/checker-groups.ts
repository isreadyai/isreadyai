import type { ICheck, TCategory } from '@isreadyai/scanner'
import { CHECK_CATEGORY_ORDER } from '@/lib/check-category-docs'

// MARK: - Checker page groups

/** One scoring category with the checks that count toward the score. */
export interface ICheckGroup {
  category: TCategory
  checks: ICheck[]
}

/** Splits checks into scored groups in category order and the unscored (weight 0) list. */
export function checkGroups(checks: readonly ICheck[]): {
  scored: ICheckGroup[]
  informational: ICheck[]
} {
  const scored = CHECK_CATEGORY_ORDER.map((category) => ({
    category,
    checks: checks.filter((check) => check.category === category && check.weight > 0),
  })).filter((group) => group.checks.length > 0)
  const informational = checks.filter((check) => check.weight === 0)
  return { scored, informational }
}
