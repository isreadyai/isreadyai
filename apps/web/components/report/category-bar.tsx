import { useTranslations } from 'next-intl'
import type { ICategoryScore } from '@isreadyai/scanner'
import { colorForScore } from '@/lib/grade'
import { checkCategoryFaqHref } from '@/lib/check-category-docs'

// MARK: - Category bar

// Wider label column than a bar would need so long names ("Smart Agent
// Readability") render in full; the shorter bar is intentional.
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-2 text-sm sm:grid-cols-[12rem_1fr_2.5rem]'
// `relative z-10` keeps these labels clickable when the whole card is itself a
// link overlay (website detail), without nesting one <a> inside another.
const LABEL_LINK =
  'text-site-muted hover:text-site-accent relative z-10 col-start-1 row-start-1 min-w-0 w-fit max-w-full truncate underline decoration-site-border underline-offset-4 transition-colors hover:decoration-site-accent'

export function CategoryBar({
  category,
  pending = false,
}: {
  category: ICategoryScore
  pending?: boolean
}) {
  const t = useTranslations('report')

  return (
    <div data-anim="cat" className={ROW_GRID}>
      <a
        href={checkCategoryFaqHref(category.category)}
        className={LABEL_LINK}
        aria-label={t('categoryDetails', { category: category.label })}
      >
        {category.label}
      </a>
      <ScoreTrack score={category.score} label={category.label} pending={pending} />
      <span className="col-start-2 row-start-1 text-right font-mono text-xs sm:col-start-3">
        {pending ? '' : category.score}
      </span>
    </div>
  )
}

// MARK: - Deep Scan aggregate row
//
// Mirrors CategoryBar's geometry but stands apart (bordered, non-linked label):
// it reports the site-wide deep-scan score that's averaged into the main number.

export function DeepScanBar({ score, divider = false }: { score: number; divider?: boolean }) {
  const t = useTranslations('report')
  return <ExtraScoreRow label={t('deepScanRow')} score={score} href="/#faq" divider={divider} />
}

// MARK: - AI Search aggregate row
//
// Same geometry as the Smart Agent row: the AI Search track score (site-wide deep
// mean when a deep scan ran, else the homepage), averaged into the main number.

export function AiSearchBar({
  score,
  divider = false,
  pending = false,
}: {
  score: number
  divider?: boolean
  pending?: boolean
}) {
  const t = useTranslations('report')
  return (
    <ExtraScoreRow
      label={t('aiSearchTitle')}
      score={score}
      href="/#faq"
      divider={divider}
      pending={pending}
    />
  )
}

// MARK: - Smart Agent aggregate row
//
// Same geometry as the Deep Scan row: the Smart agent readability score, shown
// only when that pass ran and averaged into the main number alongside it.

export function SmartAgentBar({
  score,
  divider = false,
  pending = false,
}: {
  score: number
  divider?: boolean
  pending?: boolean
}) {
  const t = useTranslations('report')
  return (
    <ExtraScoreRow
      label={t('smartScanRow')}
      score={score}
      href="/#faq"
      divider={divider}
      pending={pending}
    />
  )
}

// `divider` draws the top rule that fences the aggregate rows off from the
// category rows above — set on the FIRST aggregate row only, so there is no line
// between Deep Scan and Smart agent readability.
function ExtraScoreRow({
  label,
  score,
  href,
  divider,
  pending = false,
}: {
  label: string
  score: number
  href: string
  divider: boolean
  pending?: boolean
}) {
  return (
    <div
      data-anim="cat"
      className={`${ROW_GRID} ${divider ? 'border-site-border/60 mt-1 border-t pt-3' : ''}`}
    >
      <a href={href} className={LABEL_LINK}>
        {label}
      </a>
      <ScoreTrack score={score} label={label} pending={pending} />
      <span className="col-start-2 row-start-1 text-right font-mono text-xs sm:col-start-3">
        {pending ? '' : score}
      </span>
    </div>
  )
}

function ScoreTrack({
  score,
  label,
  pending = false,
}: {
  score: number
  label: string
  pending?: boolean
}) {
  const width = pending ? 0 : score
  return (
    <div
      className="bg-site-raised col-span-2 row-start-2 h-2 overflow-hidden rounded-full sm:col-span-1 sm:col-start-2 sm:row-start-1"
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom-styled progress bar with fill div child; native <progress> cannot contain styled children
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${width}%`, background: colorForScore(score) }}
      />
    </div>
  )
}
