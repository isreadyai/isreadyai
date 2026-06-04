import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { ErrorScreen } from '@/components/error-screen'

// MARK: - Dashboard segment not-found (friendly 404)

export default async function DashboardNotFound() {
  const t = await getTranslations('notFound')
  return (
    <ErrorScreen
      code={t('eyebrow')}
      title={t('title')}
      accent={t('accent')}
      subtitle={t('subtitle')}
      action={<Button href="/dashboard">{t('cta')}</Button>}
    />
  )
}
