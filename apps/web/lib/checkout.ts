import type Stripe from 'stripe'
import { createServiceClient } from '@isreadyai/supabase'
import type { TPaidPlan } from '@/lib/plans'
import { SITE_URL } from '@/lib/site'
import { getPriceId, getStripe, isStripeConfigured } from '@/lib/stripe'
import type { IGaSession } from '@/lib/analytics-server'
import type { IDataFastSession } from '@/lib/datafast-server'

// MARK: - Checkout session helper

/**
 * Starts a subscription for a signed-in user, going through one place for both
 * the POST /api/stripe/checkout route and the /checkout page.
 *
 * A customer must never hold more than one subscription, so this branches:
 * an existing usable subscription is repriced in place (Pro↔Team, and any
 * cancel-at-period-end is undone) and any extras are cancelled; only a customer
 * with no usable subscription is sent through a fresh Checkout session. The
 * `updated` result tells callers to skip Stripe and bounce to billing, where the
 * webhook then syncs the plan.
 */

export type TStartCheckout =
  | { url: string }
  | { updated: true }
  | { error: 'unconfigured' | 'no_email' | 'failed' }

// active/trialing/past_due all keep the customer on a paid plan, so any of them
// must be repriced rather than duplicated with a second subscription.
const USABLE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

export async function startCheckout(
  userId: string,
  email: string | null,
  plan: TPaidPlan,
  origin?: string,
  ga?: IGaSession | null,
  datafast?: IDataFastSession | null,
): Promise<TStartCheckout> {
  const base = origin ?? SITE_URL
  const priceId = getPriceId(plan)
  if (!isStripeConfigured() || priceId === null) {
    return { error: 'unconfigured' }
  }
  if (email === null || email.length === 0) {
    return { error: 'no_email' }
  }

  const service = await createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  const stripe = getStripe()
  let customerId = profile?.stripe_customer_id ?? null
  if (customerId === null) {
    // Idempotent per user: two concurrent first-time checkouts can't mint two
    // Stripe customers — which would orphan one subscription past reconciliation.
    const customer = await stripe.customers.create(
      { email, metadata: { supabase_user_id: userId } },
      { idempotencyKey: `customer:${userId}` },
    )
    customerId = customer.id
    const linkCustomer = await service
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId)
    if (linkCustomer.error !== null) {
      // Can't persist the customer id → don't open a subscription we couldn't link.
      // The `customer:${userId}` idempotency key keeps a retry on the SAME Stripe
      // customer, so failing closed here never orphans or duplicates a customer.
      return { error: 'failed' }
    }
  }

  // A brand-new customer can't have a prior subscription, so skip the lookup.
  const usable =
    profile?.stripe_customer_id === customerId ? await usableSubscriptions(stripe, customerId) : []
  if (usable.length > 0) {
    await switchPlan(stripe, usable, priceId, userId, plan)
    return { updated: true }
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Adaptive Pricing (enable in the Stripe dashboard) localises the currency;
      // the price's currency_options already carry EUR/USD/GBP amounts.
      success_url: `${base}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard/billing?checkout=cancelled`,
      metadata: {
        supabase_user_id: userId,
        plan,
        ga_client_id: ga?.clientId ?? '',
        ga_session_id: ga?.sessionId ?? '',
        ...(datafast !== null && datafast !== undefined
          ? {
              datafast_visitor_id: datafast.visitorId,
              datafast_session_id: datafast.sessionId,
            }
          : {}),
      },
      subscription_data: { metadata: { supabase_user_id: userId, plan } },
    },
    // Idempotent per (user, plan): a double-click or retry returns the same
    // session instead of opening a second subscription.
    { idempotencyKey: `checkout:${userId}:${plan}` },
  )

  return session.url !== null ? { url: session.url } : { error: 'failed' }
}

/** The customer's active/trialing/past_due subscriptions, newest first. */
async function usableSubscriptions(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Subscription[]> {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return list.data
    .filter((sub) => USABLE_STATUSES.has(sub.status))
    .toSorted((a, b) => b.created - a.created)
}

/**
 * Reprices the customer's primary subscription to the target plan (also undoing
 * any pending cancellation) and cancels every extra usable subscription, so the
 * customer is left with exactly one. Proration keeps the in-cycle switch fair.
 */
async function switchPlan(
  stripe: Stripe,
  usable: Stripe.Subscription[],
  priceId: string,
  userId: string,
  plan: TPaidPlan,
): Promise<void> {
  const [primary, ...extras] = usable
  const itemId = primary?.items.data[0]?.id
  if (primary === undefined || itemId === undefined) {
    return
  }

  await stripe.subscriptions.update(primary.id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
    metadata: { supabase_user_id: userId, plan },
  })

  for (const extra of extras) {
    // Best-effort: the webhook's duplicate reconciler may have cancelled it first.
    await stripe.subscriptions.cancel(extra.id).catch(() => null)
  }
}
