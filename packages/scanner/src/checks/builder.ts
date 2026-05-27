import type { ICheck, ICheckResult, TStatus } from '../types.ts'
import { ECheckScope, EStatus } from '../types.ts'

// MARK: - Check builder

/**
 * Tiny ergonomic layer so every check file reads as: definition + pure logic
 * returning `result(...)`. Keeps result construction uniform across families.
 */

/**
 * Check definition without `run` function; may omit `scope` (defaults to PAGE).
 *
 * @export
 */
export type ICheckDef = Omit<ICheck, 'run' | 'scope'> & Partial<Pick<ICheck, 'scope'>>

/**
 * Optional fields for check results.
 *
 * @export
 */
export type IResultExtra = Partial<
  Pick<ICheckResult, 'evidence' | 'fix' | 'impact' | 'effort' | 'docsUrl' | 'score'>
>

const DEFAULT_SCORES: Record<TStatus, number> = {
  [EStatus.PASS]: 1,
  [EStatus.WARN]: 0.5,
  [EStatus.FAIL]: 0,
  [EStatus.INFO]: 1,
  [EStatus.ERROR]: 0,
}

/**
 * Wrap a check definition and its runner into a complete check.
 *
 * @param def - The check definition (title, id, category, weight).
 * @param run - Async/sync function that executes the check logic.
 * @returns A complete ICheck with scope defaulting to PAGE.
 * @export
 */
export function defineCheck(def: ICheckDef, run: ICheck['run']): ICheck {
  return { ...def, scope: def.scope ?? ECheckScope.PAGE, run }
}

/**
 * Construct a check result from a definition, status, detail, and optional extras.
 *
 * @param def - The check definition.
 * @param status - Result status (PASS, WARN, FAIL, INFO, ERROR).
 * @param detail - Human-readable explanation.
 * @param extra - Optional evidence, fix guidance, impact, effort, docs URL, score override.
 * @returns A complete ICheckResult with default scores applied.
 * @export
 */
export function makeResult(
  def: ICheckDef,
  status: TStatus,
  detail: string,
  extra: IResultExtra = {},
): ICheckResult {
  return {
    id: def.id,
    category: def.category,
    status,
    score: extra.score ?? DEFAULT_SCORES[status],
    weight: def.weight,
    title: def.title,
    detail,
    evidence: extra.evidence,
    fix: extra.fix,
    impact: extra.impact,
    effort: extra.effort,
    docsUrl: extra.docsUrl,
  }
}
