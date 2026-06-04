'use client'

import type { TPageBannerSeverity } from '@/components/ui/page-banner'
import type { TBillingCta, TSubscriptionSeverity, TSubscriptionUiState } from '@/lib/subscription'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageBanner } from '@/components/ui/page-banner'
import { Button } from '@/components/ui/button'
import { notify } from '@/components/ui/toast'
import { EPlan } from '@/lib/plans'
import { ESubscriptionUiState } from '@/lib/subscription'

// MARK: - BillingBanner

type TBillingBannerScope = 'shell' | 'page'

interface IBillingBannerProps {
  severity: TSubscriptionSeverity
  uiState: TSubscriptionUiState
  cta: TBillingCta
  scope: TBillingBannerScope
}

interface IBannerCopy {
  severity: Exclude<TPageBannerSeverity, 'success' | 'info'>
  titleKey: string
  descriptionKey: string
  scope: TBillingBannerScope
}

const BANNER_COPY: Partial<Record<TSubscriptionUiState, IBannerCopy>> = {
  [ESubscriptionUiState.PAST_DUE]: {
    severity: 'critical',
    titleKey: 'banner.pastDueTitle',
    descriptionKey: 'banner.pastDueDescription',
    scope: 'shell',
  },
  [ESubscriptionUiState.CANCEL_AT_PERIOD_END]: {
    severity: 'warning',
    titleKey: 'banner.cancelTitle',
    descriptionKey: 'banner.cancelDescription',
    scope: 'page',
  },
  [ESubscriptionUiState.INCOMPLETE]: {
    severity: 'warning',
    titleKey: 'banner.incompleteTitle',
    descriptionKey: 'banner.incompleteDescription',
    scope: 'shell',
  },
  [ESubscriptionUiState.PAUSED]: {
    severity: 'warning',
    titleKey: 'banner.pausedTitle',
    descriptionKey: 'banner.pausedDescription',
    scope: 'shell',
  },
}

/** Renders billing alert banners for account-wide or page-scoped subscription states. */
export function BillingBanner({ severity, uiState, cta, scope }: IBillingBannerProps) {
  const t = useTranslations('billing')
  const [busy, setBusy] = useState(false)

  const copy = BANNER_COPY[uiState]
  if (
    copy === undefined ||
    copy.scope !== scope ||
    (severity !== 'warning' && severity !== 'critical')
  ) {
    return null
  }

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

  return (
    <PageBanner
      severity={copy.severity}
      title={t(copy.titleKey)}
      description={t(copy.descriptionKey)}
      action={<BannerAction cta={cta} busy={busy} go={go} t={t} />}
    />
  )
}

// MARK: - Banner action

function BannerAction({
  cta,
  busy,
  go,
  t,
}: {
  cta: TBillingCta
  busy: boolean
  go: (path: string, body?: unknown) => Promise<void>
  t: ReturnType<typeof useTranslations>
}) {
  if (cta.kind === 'choose_plan') {
    return (
      <Button
        size="sm"
        variant="primary"
        onPress={() => void go('/api/stripe/checkout', { plan: EPlan.PRO })}
        isDisabled={busy}
      >
        {t('cta.choosePlan')}
      </Button>
    )
  }
  if (cta.kind === 'none') {
    return null
  }

  return (
    <Button
      size="sm"
      // Reactivate is a calmer, opt-in action, so it reads as secondary rather
      // than the loud primary the urgent payment CTAs use.
      variant={cta.kind === 'reactivate' ? 'secondary' : 'primary'}
      onPress={() =>
        void go(
          cta.portalDeepLink ?? '/api/stripe/portal',
          cta.flow ? { flow: cta.flow } : undefined,
        )
      }
      isDisabled={busy}
    >
      {t(`banner.cta.${bannerCtaKey(cta.kind)}`)}
    </Button>
  )
}

function bannerCtaKey(kind: 'update_payment' | 'add_payment' | 'reactivate' | 'manage'): string {
  switch (kind) {
    case 'update_payment':
      return 'updatePayment'
    case 'add_payment':
      return 'addPayment'
    case 'reactivate':
      return 'reactivate'
    case 'manage':
      return 'manage'
  }
}
