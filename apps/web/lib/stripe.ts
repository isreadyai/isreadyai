import type { TPlan } from '@/lib/plans'
import Stripe from 'stripe'
import { EPlan } from '@/lib/plans'

// MARK: - Stripe client + config

/**
 * Lazy singleton: the SDK is only constructed when STRIPE_SECRET_KEY is set, so
 * the app runs fully without billing configured. The secret key is server-only
 * and is never logged or exposed to the client bundle.
 */

const API_VERSION = '2025-02-24.acacia'

let stripe: Stripe | null = null

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY
  return typeof key === 'string' && key.length > 0
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: API_VERSION })
  return stripe
}

/** Maps a paid plan to its configured Stripe price id, or null if unset. */
export function getPriceId(plan: TPlan): string | null {
  if (plan === EPlan.PRO) {
    const id = process.env.STRIPE_PRO_PRICE_ID
    return typeof id === 'string' && id.length > 0 ? id : null
  }
  if (plan === EPlan.TEAM) {
    const id = process.env.STRIPE_TEAM_PRICE_ID
    return typeof id === 'string' && id.length > 0 ? id : null
  }
  return null
}
