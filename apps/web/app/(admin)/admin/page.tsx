import { getTranslations } from 'next-intl/server'
import { Card } from '@heroui/react/card'
import { AdminMetricCard } from '@/components/admin/admin-metric-card'
import { AdminPageHeader } from '@/components/admin/admin-page-header'

/** Admin overview page showing metrics and foundation info. */
export default async function AdminOverviewPage() {
  const t = await getTranslations('admin')

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <AdminPageHeader eyebrow={t('overview')} title={t('title')} description={t('description')} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('metrics')}>
        <AdminMetricCard label={t('totalScans')} value="—" detail={t('dataPending')} />
        <AdminMetricCard label={t('activeDomains')} value="—" detail={t('dataPending')} />
        <AdminMetricCard label={t('averageScore')} value="—" detail={t('dataPending')} />
        <AdminMetricCard label={t('fixRuns')} value="—" detail={t('dataPending')} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-site-border bg-site-surface/60 border">
          <Card.Header>
            <Card.Title>{t('recentActivity')}</Card.Title>
            <Card.Description>{t('recentActivityHint')}</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="border-site-border text-site-muted rounded-xl border border-dashed px-5 py-12 text-center text-sm">
              {t('emptyActivity')}
            </div>
          </Card.Content>
        </Card>

        <Card className="border-site-border bg-site-surface/60 border">
          <Card.Header>
            <Card.Title>{t('foundation')}</Card.Title>
            <Card.Description>{t('foundationHint')}</Card.Description>
          </Card.Header>
          <Card.Content>
            <ul className="text-site-muted space-y-3 text-sm">
              <li>{t('foundationShell')}</li>
              <li>{t('foundationComponents')}</li>
              <li>{t('foundationAccess')}</li>
            </ul>
          </Card.Content>
        </Card>
      </section>
    </div>
  )
}
