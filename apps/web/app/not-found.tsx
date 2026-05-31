import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { ErrorScreen } from '@/components/error-screen'

// MARK: - 404

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <ErrorScreen
      code={t('eyebrow')}
      title={t('title')}
      accent={t('accent')}
      subtitle={t('subtitle')}
      action={<Button href="/">{t('cta')}</Button>}
    />
  )
}
