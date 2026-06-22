import { z } from 'zod'
import { cookies } from 'next/headers'
import { getAuthenticatedUser } from '@/lib/auth'
import { startCheckout } from '@/lib/checkout'
import { gaSessionFromCookies } from '@/lib/analytics-server'
import { EPlan } from '@/lib/plans'
import { isStripeConfigured } from '@/lib/stripe'

// MARK: - POST /api/stripe/checkout — start or reprice a subscription

const BodySchema = z.object({
  plan: z.enum([EPlan.PRO, EPlan.TEAM]),
})

export async function POST(request: Request): Promise<Response> {
  if (!isStripeConfigured()) {
    return errorResponse('not_configured', 'Billing is not configured.', 503)
  }

  const user = await getAuthenticatedUser()
  if (user === null) {
    return errorResponse('unauthorized', 'Sign in to manage billing.', 401)
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return errorResponse('invalid_body', 'The plan is invalid.', 400)
  }

  const origin = new URL(request.url).origin
  const cookieStore = await cookies()
  const ga = gaSessionFromCookies((name) => cookieStore.get(name)?.value)
  const result = await startCheckout(user.id, user.email ?? null, parsed.data.plan, origin, ga)

  // An existing subscriber is repriced in place, so there's no Stripe URL — the
  // client lands on billing where the webhook reflects the new plan.
  if ('updated' in result) {
    return Response.json({ url: `${origin}/dashboard/billing?checkout=success` })
  }
  if ('url' in result) {
    return Response.json({ url: result.url })
  }
  if (result.error === 'unconfigured') {
    return errorResponse('plan_unavailable', 'That plan is not available.', 503)
  }
  return errorResponse('checkout_failed', 'Could not start checkout.', 502)
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status })
}
