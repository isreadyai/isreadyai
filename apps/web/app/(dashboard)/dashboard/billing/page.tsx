import type Stripe from 'stripe'
import type { IBillingInvoice, IBillingSummaryProps } from '@/components/dashboard/billing-section'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { BillingBanner } from '@/components/dashboard/billing-banner'
import { BillingSection } from '@/components/dashboard/billing-section'
import { CheckoutFeedback } from '@/components/dashboard/checkout-feedback'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { RestrictedNotice } from '@/components/dashboard/restricted-notice'
import { getSubscriptionSummary, recommendedCta } from '@/lib/subscription'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EPlan, isPaidPlan } from '@/lib/plans'
import { getPlanPrices } from '@/lib/plan-prices'
import { resolveEntitlements } from '@/lib/entitlements'
import { isWorkspaceManager } from '@/lib/workspace'
import { resolveWorkspaceContext } from '@/lib/workspace-context'

export const dynamic = 'force-dynamic'

const INVOICE_LIMIT = 5

export default async function DashboardBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const t = await getTranslations('admin')

  // Billing is owner/admin-only; members see a placeholder instead of the plan.
  const ctx = await resolveWorkspaceContext()
  if (ctx === null || !isWorkspaceManager(ctx.role)) {
    return (
      <DashboardPage title={t('billing')} description={t('billingDescription')}>
        <RestrictedNotice />
      </DashboardPage>
    )
  }

  const checkout = (await searchParams).checkout
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'plan, subscription_status, subscription_current_period_end, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, payment_method_brand, payment_method_last4',
    )
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const summary = getSubscriptionSummary({
    plan: profile?.plan,
    subscription_status: profile?.subscription_status,
    subscription_current_period_end: profile?.subscription_current_period_end,
    stripe_customer_id: profile?.stripe_customer_id,
    stripe_subscription_id: profile?.stripe_subscription_id,
    cancel_at_period_end: profile?.cancel_at_period_end,
  })
  const cta = recommendedCta(summary)
  const entitlements = resolveEntitlements(summary.plan)

  // Localised price of the CURRENT plan (Stripe currency_options); null on Free
  // or when Stripe lacks the price, in which case the amount is simply hidden.
  const prices = await getPlanPrices((await headers()).get('x-vercel-ip-country'))
  const currentPrice =
    summary.plan === EPlan.PRO
      ? (prices?.pro ?? null)
      : summary.plan === EPlan.TEAM
        ? (prices?.team ?? null)
        : null

  let invoices: IBillingInvoice[] = []
  let invoicesUnavailable = false
  const customerId = profile?.stripe_customer_id ?? null
  if (isStripeConfigured() && customerId !== null) {
    try {
      const list = await getStripe().invoices.list({ customer: customerId, limit: INVOICE_LIMIT })
      invoices = list.data.map(toBillingInvoice)
    } catch {
      // Webhook sync may lag a fresh checkout, or Stripe is briefly unreachable;
      // the section renders a "refresh" notice instead of crashing the page.
      invoicesUnavailable = true
    }
  }

  const summaryProps: IBillingSummaryProps = {
    plan: summary.plan,
    uiState: summary.uiState,
    status: summary.status,
    currentPeriodEnd: summary.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: summary.cancelAtPeriodEnd,
    hasStripeCustomer: summary.hasStripeCustomer,
    severity: summary.severity,
    renewsOrEndsLabel: summary.renewsOrEndsLabel,
    paymentMethodBrand: profile?.payment_method_brand ?? null,
    paymentMethodLast4: profile?.payment_method_last4 ?? null,
  }

  return (
    <DashboardPage title={t('billing')} description={t('billingDescription')}>
      {checkout === 'success' || checkout === 'cancelled' ? (
        <CheckoutFeedback
          status={checkout === 'success' ? 'success' : 'cancelled'}
          activated={isPaidPlan(summary.plan)}
        />
      ) : null}
      <BillingBanner severity={summary.severity} uiState={summary.uiState} cta={cta} scope="page" />
      <BillingSection
        summary={summaryProps}
        entitlements={entitlements}
        invoices={invoices}
        cta={cta}
        invoicesUnavailable={invoicesUnavailable}
        currentPrice={currentPrice}
      />
    </DashboardPage>
  )
}

function toBillingInvoice(invoice: Stripe.Invoice): IBillingInvoice {
  return {
    id: invoice.id,
    created: invoice.created,
    amount: invoice.amount_paid || invoice.amount_due,
    currency: invoice.currency,
    status: invoice.status,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
  }
}
