import type Stripe from 'stripe'
import { createServiceClient } from '@isreadyai/supabase'
import { requireSuccess } from '@/lib/db'
import { EPlan, planOrFree } from '@/lib/plans'
import type { TPlan } from '@/lib/plans'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { higherPlan, planFromPrice, planFromStatus, planRank } from '@/lib/stripe-plan'

// MARK: - POST /api/stripe/webhook — Stripe subscription lifecycle

/**
 * Security: the raw request body is verified against the stripe-signature
 * header BEFORE anything else, so only Stripe-signed events are ever processed.
 * All writes use the service client (RLS-bypassing, server-only). The plan is
 * never trusted from the request — it is derived from the verified event.
 */

export async function POST(request: Request): Promise<Response> {
  if (!isStripeConfigured()) {
    return Response.json({ error: 'not_configured' }, { status: 503 })
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (typeof secret !== 'string' || secret.length === 0) {
    return Response.json({ error: 'not_configured' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (signature === null) {
    return Response.json({ error: 'missing_signature' }, { status: 400 })
  }

  const stripe = getStripe()
  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
  } catch {
    return Response.json({ error: 'invalid_signature' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { error: insertError } = await service
    .from('stripe_webhook_events')
    .insert({ stripe_event_id: event.id, type: event.type })
  if (insertError !== null) {
    // The event was already recorded. Skip ONLY when a prior attempt finished
    // (processed_at set); a row left behind by a FAILED attempt is reprocessed on
    // Stripe's retry instead of being permanently dropped.
    const { data: prior } = await service
      .from('stripe_webhook_events')
      .select('processed_at')
      .eq('stripe_event_id', event.id)
      .maybeSingle()
    if (prior !== null && prior.processed_at !== null) {
      return Response.json({ received: true })
    }
  }

  try {
    await handleEvent(stripe, service, event)
    await service
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq('stripe_event_id', event.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    await service
      .from('stripe_webhook_events')
      .update({ error: message })
      .eq('stripe_event_id', event.id)
    return Response.json({ error: 'processing_failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

async function handleEvent(
  stripe: Stripe,
  service: TServiceClient,
  event: Stripe.Event,
): Promise<void> {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription?.id ?? null)
    if (subscriptionId === null) {
      return
    }
    const subscription = await retrieveSubscription(stripe, subscriptionId)
    await syncSubscription(stripe, service, subscription)
    return
  }
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.trial_will_end'
  ) {
    // trial_will_end carries no plan change; this is a safe re-sync so the
    // stored status/period/payment-method stay current.
    // FOLLOWUP: emit a "trial ending" notification on trial_will_end once the
    // notifications table is wired by a later wave.
    await syncSubscription(stripe, service, event.data.object)
    return
  }
  if (event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_succeeded') {
    // payment_failed never downgrades the plan (planFromStatus keeps the plan
    // on past_due); payment_succeeded restores active. Both re-sync from the
    // canonical subscription so status reflects reality. The subscription id
    // can be absent on one-off invoices, so guard for it.
    const subscriptionId = invoiceSubscriptionId(event.data.object)
    if (subscriptionId === null) {
      return
    }
    const subscription = await retrieveSubscription(stripe, subscriptionId)
    await syncSubscription(stripe, service, subscription)
  }
}

/** Reads the subscription id off an invoice regardless of expansion state. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.subscription
  if (subscription === null || subscription === undefined) {
    return null
  }
  return typeof subscription === 'string' ? subscription : subscription.id
}

/** Retrieves a subscription with the default payment method expanded. */
async function retrieveSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  })
}

async function syncSubscription(
  stripe: Stripe,
  service: TServiceClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

  const { data: profile } = await service
    .from('profiles')
    .select('id, plan')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (profile === null) {
    return
  }

  const pricePlan = planFromPrice(subscription.items.data[0]?.price.id ?? null)
  const fromThisSub = planFromStatus(subscription.status, pricePlan, planOrFree(profile.plan))
  // Defensive against a customer who transiently holds >1 subscription: resolve
  // to the HIGHEST plan they're actively paying for, never whichever event
  // arrived last. A higher plan set to cancel_at_period_end is still `active`
  // here, so it keeps reading as that plan until the period actually ends.
  const nextPlan = await highestActivePlan(stripe, customerId, fromThisSub)
  const periodEnd = subscription.current_period_end ?? null
  const card = await resolveCard(stripe, subscription, customerId)

  // These two writes carry the entitlement change. Their errors MUST surface: a
  // silently-failed update would let the handler return 200, Stripe mark the event
  // delivered, and the customer's plan stay permanently stale. requireSuccess
  // throws → the caller records the error and returns 500 → Stripe retries.
  const profileSync = await service
    .from('profiles')
    .update({
      plan: nextPlan,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_current_period_end:
        periodEnd === null ? null : new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      payment_method_brand: card?.brand ?? null,
      payment_method_last4: card?.last4 ?? null,
    })
    .eq('id', profile.id)
  requireSuccess(profileSync, 'stripe webhook: profile entitlement sync')

  const keySync = await service
    .from('api_keys')
    .update({ plan: nextPlan })
    .eq('user_id', profile.id)
    .is('revoked_at', null)
  requireSuccess(keySync, 'stripe webhook: api_keys plan sync')

  // Self-heal any duplicate subscriptions from a checkout race (defense-in-depth
  // behind the idempotency keys): keep exactly the highest-ranked one.
  await reconcileDuplicateSubscriptions(stripe, customerId)
}

// active/trialing/past_due all keep a customer on a paid plan; only these are
// considered when reconciling the highest plan across multiple subscriptions.
const USABLE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

/**
 * The highest plan across all the customer's usable subscriptions, falling back
 * to the just-synced subscription's plan when the list yields nothing usable.
 * Hardens plan resolution against the brief window where two subscriptions
 * coexist (e.g. mid-upgrade) so a lower one can never clobber a higher one.
 */
async function highestActivePlan(
  stripe: Stripe,
  customerId: string,
  fallback: TPlan,
): Promise<TPlan> {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  let best: TPlan | null = null
  for (const sub of list.data) {
    if (!USABLE_STATUSES.has(sub.status)) {
      continue
    }
    const plan = planFromStatus(
      sub.status,
      planFromPrice(sub.items.data[0]?.price.id ?? null),
      fallback,
    )
    best = best === null ? plan : higherPlan(best, plan)
  }
  return best ?? fallback
}

/**
 * A customer must hold exactly one subscription. If more than one is usable (a
 * checkout race that slipped past the idempotency keys), cancel all but the
 * highest-ranked (newest wins ties). No-op in the normal single-subscription
 * case; cancels are best-effort so an already-cancelled extra is harmless.
 */
async function reconcileDuplicateSubscriptions(stripe: Stripe, customerId: string): Promise<void> {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  const usable = list.data
    .filter((sub) => USABLE_STATUSES.has(sub.status))
    .toSorted((a, b) => {
      const rankDelta =
        planRank(planFromPrice(b.items.data[0]?.price.id ?? null) ?? EPlan.FREE) -
        planRank(planFromPrice(a.items.data[0]?.price.id ?? null) ?? EPlan.FREE)
      return rankDelta !== 0 ? rankDelta : b.created - a.created
    })
  for (const extra of usable.slice(1)) {
    await stripe.subscriptions.cancel(extra.id).catch(() => null)
  }
}

interface ICardSummary {
  brand: string
  last4: string
}

/**
 * Resolves the card backing the subscription's default payment method, falling
 * back to the customer's invoice-settings default. Returns null whenever no
 * card-type payment method is available so the caller can clear the columns.
 */
async function resolveCard(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  customerId: string,
): Promise<ICardSummary | null> {
  const fromSubscription = cardFromPaymentMethod(subscription.default_payment_method)
  if (fromSubscription !== null) {
    return fromSubscription
  }

  const paymentMethodId =
    typeof subscription.default_payment_method === 'string'
      ? subscription.default_payment_method
      : null
  if (paymentMethodId !== null) {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    const fromRetrieved = cardFromPaymentMethod(paymentMethod)
    if (fromRetrieved !== null) {
      return fromRetrieved
    }
  }

  return customerDefaultCard(stripe, customerId)
}

/** Reads the customer's invoice-settings default payment method card, if any. */
async function customerDefaultCard(
  stripe: Stripe,
  customerId: string,
): Promise<ICardSummary | null> {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  if (customer.deleted === true) {
    return null
  }
  return cardFromPaymentMethod(customer.invoice_settings.default_payment_method)
}

/** Extracts a card summary from an expanded payment method, else null. */
function cardFromPaymentMethod(
  paymentMethod: string | Stripe.PaymentMethod | null | undefined,
): ICardSummary | null {
  if (paymentMethod === null || paymentMethod === undefined || typeof paymentMethod === 'string') {
    return null
  }
  const card = paymentMethod.card
  if (card === undefined) {
    return null
  }
  return { brand: card.brand, last4: card.last4 }
}
