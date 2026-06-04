'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button, EButtonVariant } from '@/components/ui/button'
import { ErrorScreen } from '@/components/error-screen'

// MARK: - Dashboard segment error boundary (friendly 500)
//
// Any render/data failure in a dashboard route surfaces as the shared 500
// screen instead of a bare card. We log the real error; nothing from
// error.message is rendered.

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('error')

  useEffect(() => {
    console.error('[dashboard] route error:', error)
  }, [error])

  return (
    <ErrorScreen
      code={t('eyebrow')}
      title={t('title')}
      accent={t('accent')}
      subtitle={t('subtitle')}
      action={
        <>
          <Button variant={EButtonVariant.PRIMARY} onPress={reset}>
            {t('retry')}
          </Button>
          <Button variant={EButtonVariant.NEUTRAL} href="/dashboard">
            {t('home')}
          </Button>
        </>
      }
    />
  )
}
