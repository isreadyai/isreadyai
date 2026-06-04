import { useTranslations } from 'next-intl'

// MARK: - Dashboard segment loading skeleton
//
// Server component (no client JS): Next renders this while a dashboard route's
// async data resolves, so navigations show structure instead of a blank frame.
// Geometry mirrors DashboardPage — an h-16 bordered header bar over a padded
// body — so the skeleton occupies the same footprint as the real page.

const SKELETON_CARDS = [0, 1, 2, 3]
const SKELETON_ROWS = [0, 1, 2, 3, 4]

export default function DashboardLoading() {
  const t = useTranslations('a11y')
  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- structural skeleton container wrapping block children; <output> is phrasing content and would produce invalid HTML
    <div role="status" aria-label={t('loading')} aria-busy="true">
      <div className="border-site-border bg-site-background/85 sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-5 lg:px-8">
        <div className="bg-site-raised h-4 w-40 animate-pulse rounded-md" />
      </div>
      <div className="space-y-6 px-5 pt-6 lg:px-8 lg:pt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SKELETON_CARDS.map((i) => (
            <div key={i} className="border-site-border bg-site-surface rounded-2xl border p-5">
              <div className="bg-site-raised h-3 w-24 animate-pulse rounded-md" />
              <div className="bg-site-raised mt-4 h-8 w-16 animate-pulse rounded-md" />
              <div className="bg-site-raised mt-3 h-3 w-20 animate-pulse rounded-md" />
            </div>
          ))}
        </div>
        <div className="border-site-border bg-site-surface space-y-4 rounded-2xl border p-5">
          {SKELETON_ROWS.map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="bg-site-raised h-4 flex-1 animate-pulse rounded-md" />
              <div className="bg-site-raised h-4 w-24 animate-pulse rounded-md" />
              <div className="bg-site-raised h-4 w-16 animate-pulse rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}
