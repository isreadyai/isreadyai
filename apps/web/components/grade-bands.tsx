import { getTranslations } from 'next-intl/server'
import { EGrade, GRADE_THRESHOLDS, type TGrade } from '@isreadyai/scanner'
import { GRADE_TEXT } from '@/lib/grade'

// MARK: - Grade bands

const BANDS: readonly { grade: TGrade; max: number }[] = [
  { grade: EGrade.EXCELLENT, max: 100 },
  { grade: EGrade.GOOD, max: GRADE_THRESHOLDS[EGrade.EXCELLENT] - 1 },
  { grade: EGrade.MODERATE, max: GRADE_THRESHOLDS[EGrade.GOOD] - 1 },
  { grade: EGrade.POOR, max: GRADE_THRESHOLDS[EGrade.MODERATE] - 1 },
]

/** Explains the four score grades with their ranges and, when available, the live share of sites in each. */
export async function GradeBands({
  grades,
  sites,
}: {
  grades: Record<TGrade, number> | null
  sites: number | null
}) {
  const t = await getTranslations('grades')
  const tGrade = await getTranslations('report.grade')
  return (
    <div>
      <h3 className="text-site-text text-lg font-semibold">{t('title')}</h3>
      <p className="text-site-muted mt-2 max-w-2xl text-sm">{t('intro')}</p>
      <ol className="mt-6 grid gap-3">
        {BANDS.map(({ grade, max }) => (
          <li
            key={grade}
            className="border-site-border bg-site-surface/50 flex flex-col gap-1 rounded-xl border px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <div className="flex items-baseline justify-between gap-3 sm:w-56 sm:shrink-0">
              <span className={`${GRADE_TEXT[grade]} font-semibold`}>{tGrade(grade)}</span>
              <span className="text-site-muted font-mono text-sm">
                {t('range', { min: GRADE_THRESHOLDS[grade], max })}
              </span>
            </div>
            <p className="text-site-muted flex-1 text-sm">{t(`${grade}Body`)}</p>
            {grades !== null && sites !== null && sites > 0 ? (
              <span className="text-site-muted font-mono text-sm">
                {t('share', { percent: Math.round((100 * grades[grade]) / sites) })}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
