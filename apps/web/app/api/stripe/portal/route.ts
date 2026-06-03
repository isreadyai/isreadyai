import type Stripe from 'stripe'
import { createServiceClient } from '@isreadyai/supabase'
import { getAuthenticatedUser } from '@/lib/auth'
import { SITE_URL } from '@/lib/site'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// MARK: - POST /api/stripe/portal — open the Stripe billing portal

/**
 * Optional `flow` deep-links the portal straight to a specific task (update the
 * payment method, cancel) instead of the generic portal home, so the billing
 * CTAs land the user on the exact action. Unknown/absent flow → portal home.
 */
const FLOW_DATA: Record<string, Stripe.BillingPortal.SessionCreateParams.FlowData['type']> = {
  payment_method_update: 'payment_method_update',
  subscription_cancel: 'subscription_cancel',
}

export async function POST(request: Request): Promise<Response> {
  if (!isStripeConfigured()) {
    return errorResponse('not_configured', 'Billing is not configured.', 503)
  }

  const user = await getAuthenticatedUser()
  if (user === null) {
    return errorResponse('unauthorized', 'Sign in to manage billing.', 401)
  }

  const body = (await request.json().catch(() => null)) as { flow?: unknown } | null
  const flowType = typeof body?.flow === 'string' ? FLOW_DATA[body.flow] : undefined

  const service = await createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', user.id)
    .maybeSingle()

  const customerId = profile?.stripe_customer_id ?? null
  if (customerId === null) {
    return errorResponse('no_customer', 'No billing account found.', 404)
  }

  const returnUrl = `${SITE_URL}/dashboard/billing`
  const params: Stripe.BillingPortal.SessionCreateParams = {
    customer: customerId,
    return_url: returnUrl,
  }
  // subscription_cancel needs the subscription id; skip the flow if we lack it.
  if (flowType === 'subscription_cancel' && typeof profile?.stripe_subscription_id === 'string') {
    params.flow_data = {
      type: 'subscription_cancel',
      subscription_cancel: { subscription: profile.stripe_subscription_id },
    }
  } else if (flowType === 'payment_method_update') {
    params.flow_data = { type: 'payment_method_update' }
  }

  const session = await getStripe().billingPortal.sessions.create(params)
  return Response.json({ url: session.url })
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status })
}
