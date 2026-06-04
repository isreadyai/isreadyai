'use client'

import { Card } from '@heroui/react/card'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, EButtonVariant } from '@/components/ui/button'
import { acceptInvitation } from '@/lib/actions/team'

// MARK: - Accept invitation island

/** Team invitation acceptance card. */
export function AcceptInvite({ token }: { token: string }) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onAccept(): void {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvitation(token)
      if (result.ok) {
        router.push('/dashboard/team')
      } else {
        setError(result.error === 'email_mismatch' ? t('teamAcceptMismatch') : t('teamAcceptError'))
      }
    })
  }

  return (
    <Card className="border-site-border bg-site-surface/60 mx-auto max-w-md border">
      <Card.Content className="space-y-4 text-center">
        <h1 className="text-lg font-semibold">{t('teamAcceptTitle')}</h1>
        <p className="text-site-muted text-sm">{t('teamAcceptBody')}</p>
        <Button variant={EButtonVariant.PRIMARY} onPress={onAccept} isDisabled={pending}>
          {t('teamAccept')}
        </Button>
        {error !== null ? (
          <p className="text-danger text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </Card.Content>
    </Card>
  )
}
