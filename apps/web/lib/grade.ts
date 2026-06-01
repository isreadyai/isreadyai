import type { TGrade } from '@isreadyai/scanner'
import { gradeOf } from '@isreadyai/scanner'

// MARK: - Grade → theme color

/**
 * Thresholds live in the scanner (gradeOf) so web and CLI can't disagree.
 */

export const GRADE_COLORS: Record<TGrade, string> = {
  excellent: 'var(--color-score-excellent)',
  good: 'var(--color-score-good)',
  moderate: 'var(--color-score-moderate)',
  poor: 'var(--color-score-poor)',
}

export const GRADE_TEXT: Record<TGrade, string> = {
  excellent: 'text-score-excellent',
  good: 'text-score-good',
  moderate: 'text-score-moderate',
  poor: 'text-score-poor',
}

export function colorForScore(score: number): string {
  return GRADE_COLORS[gradeOf(score)]
}

export function textForScore(score: number): string {
  return GRADE_TEXT[gradeOf(score)]
}
