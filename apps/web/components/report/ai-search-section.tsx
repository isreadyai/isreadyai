import type { ICategoryScore } from '@isreadyai/scanner'
import { useTranslations } from 'next-intl'
import { gradeOf } from '@isreadyai/scanner'
import { ScoreRing } from './score-ring'
import { CategoryBar } from './category-bar'

export function AiSearchSection({
  score,
  categories,
  deep,
  pending = false,
}: {
  score: number
  categories: ICategoryScore[]
  deep: boolean
  pending?: boolean
}) {
  const t = useTranslations('report')
  const grade = gradeOf(score)

  return (
    <section className="mt-10">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('aiSearchTitle')}</h2>
          {deep ? (
            <span className="text-site-accent border-site-accent/40 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase">
              {t('deepBadge')}
            </span>
          ) : null}
        </div>
        <p className="text-site-muted mt-1 text-sm">{t('aiSearchDescription')}</p>
      </div>
      <div className="border-site-accent/40 bg-site-surface/50 mt-4 rounded-2xl border p-5 sm:p-8">
        <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
          <ScoreRing
            score={score}
            grade={grade}
            label={pending ? t('scoring') : t(`grade.${grade}`)}
            loading={pending}
          />
          <div className="@container space-y-3">
            {categories.map((c) => (
              <CategoryBar key={c.category} category={c} pending={pending} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
