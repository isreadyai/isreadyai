import type Stripe from 'stripe'
import type { TPlan } from '@/lib/plans'

import { EPlan } from '@/lib/plans'
import { getPriceId } from '@/lib/stripe'

// MARK: - Subscription → plan resolution

// Team outranks Pro outranks Free, so a customer who (transiently) holds more
// than one usable subscription resolves to the highest plan they're paying for,
// never whichever event Stripe happened to deliver last.
const PLAN_RANK: Record<TPlan, number> = {
  [EPlan.FREE]: 0,
  [EPlan.PRO]: 1,
  [EPlan.TEAM]: 2,
}

/** The higher-tier of two plans by rank (Team > Pro > Free). */
export function higherPlan(a: TPlan, b: TPlan): TPlan {
  return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b
}

/** Numeric rank of a plan (Team=2 > Pro=1 > Free=0), for ordering subscriptions. */
export function planRank(plan: TPlan): number {
  return PLAN_RANK[plan]
}

/** Resolves a Stripe price id back to the paid plan it sells, or null. */
export function planFromPrice(priceId: string | null): TPlan | null {
  if (priceId === null) {
    return null
  }
  if (priceId === getPriceId(EPlan.PRO)) {
    return EPlan.PRO
  }
  if (priceId === getPriceId(EPlan.TEAM)) {
    return EPlan.TEAM
  }
  return null
}

/**
 * active/trialing grant the subscribed price's plan; past_due keeps the current
 * plan as a bounded grace while Stripe retries collection; every other status
 * (unpaid, paused, incomplete, canceled, incomplete_expired) revokes to free.
 */
export function planFromStatus(
  status: Stripe.Subscription.Status,
  pricePlan: TPlan | null,
  currentPlan: TPlan,
): TPlan {
  if (status === 'active' || status === 'trialing') {
    return pricePlan ?? currentPlan
  }
  // past_due keeps the plan as a bounded grace: Stripe's dunning retries the
  // charge, so we don't downgrade a likely-recoverable customer mid-retry.
  if (status === 'past_due') {
    return currentPlan
  }
  return EPlan.FREE
}
