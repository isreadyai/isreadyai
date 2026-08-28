import type Stripe from 'stripe'

// MARK: - Version-sensitive reads of Stripe objects (Basil 2025-03-31 and later)

/** The subscription an invoice bills, or null for a one-off invoice. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription
  if (subscription === null || subscription === undefined) {
    return null
  }
  return typeof subscription === 'string' ? subscription : subscription.id
}

/** Unix seconds when the latest item period of a subscription ends, or null without items. */
export function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  let latest: number | null = null
  for (const item of subscription.items.data) {
    if (latest === null || item.current_period_end > latest) {
      latest = item.current_period_end
    }
  }
  return latest
}
