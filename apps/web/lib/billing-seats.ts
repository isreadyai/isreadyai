import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// MARK: - Seat → Stripe quantity sync

/**
 * Keeps the Team subscription's seat quantity in step with active membership.
 *
 * OPT-IN: the chosen seat model (audit §15.1) is a FLAT Team price with included
 * seats enforced by a hard limit (seat_limit) — there, quantity must stay 1, so
 * this is a no-op. Set STRIPE_PER_SEAT=true only once the Team price is billed
 * per active seat; then membership changes resize the subscription quantity.
 *
 * Best-effort: proration is suppressed so a membership change never triggers a
 * surprise mid-cycle charge — the new quantity is billed on the next invoice.
 */
export async function syncSeatQuantity(workspaceId: string): Promise<void> {
  if (process.env.STRIPE_PER_SEAT !== 'true' || !isStripeConfigured() || !isSupabaseConfigured()) {
    return
  }

  const service = await createServiceClient()
  const { data: workspace } = await service
    .from('workspaces')
    .select('stripe_subscription_id')
    .eq('id', workspaceId)
    .maybeSingle()
  const subscriptionId = workspace?.stripe_subscription_id ?? null
  if (subscriptionId === null) {
    return
  }

  const { count } = await service
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  const seats = Math.max(1, count ?? 1)

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const item = subscription.items.data[0]
  if (item === undefined || item.quantity === seats) {
    return
  }
  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, quantity: seats }],
    proration_behavior: 'none',
  })
}
