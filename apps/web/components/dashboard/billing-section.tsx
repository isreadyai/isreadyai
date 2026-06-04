'use client'

import type { TPlan } from '@/lib/plans'
import type { TBillingCta, TSubscriptionSeverity, TSubscriptionUiState } from '@/lib/subscription'
import type { IEntitlements } from '@/lib/entitlements'
import type { IPlanPrice } from '@/lib/plan-prices'
import type { IDataTableColumn } from '@/components/ui/data-table'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Card } from '@heroui/react/card'
import { Button, EButtonAppearance, EButtonVariant } from '@/components/ui/button'
import { DataTable, ETableAlign, ETableState, RowActionButton } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { PageBanner } from '@/components/ui/page-banner'
import { PlanIcon } from '@/components/ui/plan-icon'
import { UsageMeter } from '@/components/ui/usage-meter'
import { notify } from '@/components/ui/toast'
import { EPlan, isPaidPlan } from '@/lib/plans'
import { ESubscriptionUiState } from '@/lib/subscription'

// MARK: - Props

export interface IBillingSummaryProps {
  plan: TPlan
  uiState: TSubscriptionUiState
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hasStripeCustomer: boolean
  severity: TSubscriptionSeverity
  renewsOrEndsLabel: 'renews' | 'ends' | null
  paymentMethodBrand: string | null
  paymentMethodLast4: string | null
}

export interface IBillingInvoice {
  id: string
  created: number
  amount: number
  currency: string
  status: string | null
  hostedInvoiceUrl: string | null
}

export interface IBillingUsage {
  fixRunsUsed: number
  periodResetAt: string | null
}

interface IBillingSectionProps {
  summary: IBillingSummaryProps
  entitlements: IEntitlements
  invoices: IBillingInvoice[]
  cta: TBillingCta
  invoicesUnavailable?: boolean
  usage?: IBillingUsage
  /** Localised price of the current plan (Stripe currency_options); null hides it. */
  currentPrice?: IPlanPrice | null
}

// MARK: - Status chip tone

const STATE_TONE: Record<TSubscriptionUiState, string> = {
  [ESubscriptionUiState.ACTIVE]: 'border-site-secondary/45 text-site-secondary',
  [ESubscriptionUiState.TRIALING]: 'border-site-secondary/45 text-site-secondary',
  [ESubscriptionUiState.PAST_DUE]: 'border-danger/55 text-danger',
  [ESubscriptionUiState.CANCEL_AT_PERIOD_END]: 'border-warning/55 text-warning',
  [ESubscriptionUiState.CANCELED]: 'border-danger/55 text-danger',
  [ESubscriptionUiState.INCOMPLETE]: 'border-warning/55 text-warning',
  [ESubscriptionUiState.PAUSED]: 'border-warning/55 text-warning',
  [ESubscriptionUiState.NONE]: 'border-site-border text-site-muted',
}

const INVOICE_OK_STATUSES = new Set(['paid'])

/** Plan card, usage meter, and invoice history for the billing page. */
export function BillingSection({
  summary,
  entitlements,
  invoices,
  cta,
  invoicesUnavailable = false,
  usage,
  currentPrice = null,
}: IBillingSectionProps) {
  const t = useTranslations('billing')
  const format = useFormatter()
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

  const periodEnd = summary.currentPeriodEnd !== null ? new Date(summary.currentPeriodEnd) : null
  const resetAt =
    usage?.periodResetAt !== null && usage?.periodResetAt !== undefined
      ? new Date(usage.periodResetAt)
      : null

  const invoiceColumns: Array<IDataTableColumn<IBillingInvoice>> = [
    {
      key: 'date',
      header: t('invoiceColDate'),
      render: (invoice) => (
        <span className="text-site-text text-sm tabular-nums">
          {format.dateTime(new Date(invoice.created * 1000), { dateStyle: 'medium' })}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('invoiceColStatus'),
      render: (invoice) => (
        <span className="text-site-muted text-xs">
          {invoice.status !== null ? t(`invoiceStatus.${invoiceStatusKey(invoice.status)}`) : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('invoiceColAmount'),
      align: ETableAlign.END,
      render: (invoice) => (
        <span className="text-site-text text-sm tabular-nums">
          {format.number(invoice.amount / 100, {
            style: 'currency',
            currency: invoice.currency.toUpperCase(),
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: ETableAlign.END,
      render: (invoice) =>
        invoice.hostedInvoiceUrl !== null ? (
          <div className="flex items-center justify-end">
            <RowActionButton
              label={t('invoiceView')}
              onPress={() => window.open(invoice.hostedInvoiceUrl ?? '', '_blank', 'noopener')}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
                </svg>
              }
            />
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      {invoicesUnavailable ? (
        <PageBanner
          severity="warning"
          title={t('syncDelayedTitle')}
          description={t('syncDelayedDescription')}
        />
      ) : null}

      <Card
        className={`bg-site-surface/60 border ${isPaidPlan(summary.plan) ? 'border-site-secondary/50' : 'border-site-border'}`}
      >
        <Card.Content className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-site-muted text-xs tracking-wide uppercase">{t('planLabel')}</p>
              <p className="text-site-text mt-1 flex items-center gap-2 text-lg font-semibold">
                <PlanIcon plan={summary.plan} className="size-4" />
                {t(`plan.${summary.plan}`)}
                {currentPrice !== null ? (
                  <span className="text-site-muted text-sm font-normal tabular-nums">
                    {format.number(currentPrice.amount / 100, {
                      style: 'currency',
                      currency: currentPrice.currency.toUpperCase(),
                      maximumFractionDigits: 0,
                    })}
                    /{currentPrice.interval === 'month' ? t('perMonth') : currentPrice.interval}
                  </span>
                ) : null}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATE_TONE[summary.uiState]}`}
            >
              {t(`status.${summary.uiState}`)}
            </span>
          </div>

          {periodEnd !== null && summary.renewsOrEndsLabel !== null ? (
            <div>
              <p className="text-site-muted text-xs tracking-wide uppercase">
                {t(`periodLabel.${summary.renewsOrEndsLabel}`)}
              </p>
              <p className="text-site-text mt-1 text-sm">
                {format.dateTime(periodEnd, { dateStyle: 'long' })}
              </p>
            </div>
          ) : null}

          <div>
            <p className="text-site-muted text-xs tracking-wide uppercase">
              {t('paymentMethodLabel')}
            </p>
            <p className="text-site-text mt-1 text-sm">
              {summary.paymentMethodBrand !== null && summary.paymentMethodLast4 !== null
                ? t('cardOnFile', {
                    brand: summary.paymentMethodBrand,
                    last4: summary.paymentMethodLast4,
                  })
                : t('noCardOnFile')}
            </p>
          </div>

          {usage !== undefined ? (
            <UsageMeter
              label={t('fixRunsLabel')}
              used={usage.fixRunsUsed}
              limit={entitlements.fixRunsPerPeriod}
              unit={t('fixRunsUnit')}
              periodResetAt={resetAt}
            />
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <PrimaryCta cta={cta} busy={busy} go={go} t={t} />
          </div>
        </Card.Content>
      </Card>

      {!isPaidPlan(summary.plan) ? (
        <Card className="border-site-border bg-site-surface/60 border">
          <Card.Content className="space-y-4">
            <div>
              <p className="text-site-text text-sm font-semibold">{t('upgradeTitle')}</p>
              <p className="text-site-muted mt-1 text-sm">{t('upgradeDescription')}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant={EButtonVariant.SECONDARY}
                onPress={() => void go('/api/stripe/checkout', { plan: EPlan.PRO })}
                isDisabled={busy}
              >
                {t('upgradePro')}
              </Button>
              <Button
                variant={EButtonVariant.SECONDARY}
                onPress={() => void go('/api/stripe/checkout', { plan: EPlan.TEAM })}
                isDisabled={busy}
              >
                {t('upgradeTeam')}
              </Button>
            </div>
          </Card.Content>
        </Card>
      ) : null}

      <div className="space-y-3">
        <p className="text-site-text text-sm font-semibold">{t('invoicesTitle')}</p>
        <DataTable
          columns={invoiceColumns}
          rows={invoices}
          getRowKey={(invoice) => invoice.id}
          state={invoices.length === 0 ? ETableState.EMPTY : ETableState.IDLE}
          emptyState={
            <EmptyState
              title={t('invoicesEmptyTitle')}
              description={t('invoicesEmptyDescription')}
            />
          }
        />
      </div>
    </div>
  )
}

// MARK: - Primary CTA

function PrimaryCta({
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
  switch (cta.kind) {
    case 'choose_plan':
      return (
        <Button
          variant={EButtonVariant.PRIMARY}
          onPress={() => void go('/api/stripe/checkout', { plan: EPlan.PRO })}
          isDisabled={busy}
        >
          {t('cta.choosePlan')}
        </Button>
      )
    case 'update_payment':
    case 'add_payment':
    case 'reactivate':
    case 'manage':
      return (
        <Button
          variant={EButtonVariant.PRIMARY}
          appearance={EButtonAppearance.OUTLINE}
          onPress={() =>
            void go(
              cta.portalDeepLink ?? '/api/stripe/portal',
              cta.flow ? { flow: cta.flow } : undefined,
            )
          }
          isDisabled={busy}
        >
          {t(`cta.${cta.kind === 'add_payment' ? 'addPayment' : ctaKey(cta.kind)}`)}
        </Button>
      )
    case 'none':
    default:
      return null
  }
}

function ctaKey(kind: 'update_payment' | 'reactivate' | 'manage'): string {
  switch (kind) {
    case 'update_payment':
      return 'updatePayment'
    case 'reactivate':
      return 'reactivate'
    case 'manage':
      return 'manage'
  }
}

function invoiceStatusKey(status: string): 'paid' | 'open' | 'other' {
  if (INVOICE_OK_STATUSES.has(status)) return 'paid'
  if (status === 'open') return 'open'
  return 'other'
}
