'use client'

import type { TPlan } from '@/lib/plans'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { notify } from '@/components/ui/toast'
import { EPlan, isPaidPlan } from '@/lib/plans'

/** Plan upgrade/management actions (checkout or Stripe portal). */
export function BillingPanel({ plan }: { plan: TPlan }) {
  const t = useTranslations('billing')
  const [busy, setBusy] = useState(false)

  async function go(path: string, body?: unknown): Promise<void> {
    setBusy(true)
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = (await response.json()) as { url?: string }
      if (response.ok && typeof data.url === 'string') {
        window.location.assign(data.url)
        return
      }
      notify.error(t('error'))
    } catch {
      notify.error(t('error'))
    }
    setBusy(false)
  }

  const isPaid = isPaidPlan(plan)

  return (
    <div className="flex flex-col gap-3">
      {isPaid ? (
        <Button
          appearance="outline"
          onPress={() => void go('/api/stripe/portal')}
          isDisabled={busy}
        >
          {t('manage')}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onPress={() => void go('/api/stripe/checkout', { plan: EPlan.PRO })}
            isDisabled={busy}
          >
            {t('upgradePro')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => void go('/api/stripe/checkout', { plan: EPlan.TEAM })}
            isDisabled={busy}
          >
            {t('upgradeTeam')}
          </Button>
        </div>
      )}
    </div>
  )
}
