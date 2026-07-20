import { redirect } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { CheckoutSignup } from '@/components/checkout/checkout-signup'
import { startCheckout } from '@/lib/checkout'
import { gaSessionFromCookies } from '@/lib/analytics-server'
import { dataFastSessionFromCookies } from '@/lib/datafast-server'
import { EPlan } from '@/lib/plans'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// MARK: - /checkout?plan=<pro|team>
//
// Single entry point for every premium CTA. A registered user goes straight to
// Stripe; a guest (anonymous session) registers inline first, then proceeds.

/** Checkout entry point for premium plan upgrades (Pro/Team). */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const planParam = (await searchParams).plan
  const plan = planParam === EPlan.PRO || planParam === EPlan.TEAM ? planParam : null
  if (plan === null) {
    redirect('/pricing')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No session at all (anon bootstrap not yet run): bounce through login.
  if (user === null) {
    redirect(`/login?redirect=${encodeURIComponent(`/checkout?plan=${plan}`)}`)
  }

  // Registered account → straight to Stripe.
  if (user.is_anonymous !== true && typeof user.email === 'string' && user.email.length > 0) {
    const head = await headers()
    const host = head.get('host')
    const origin =
      host !== null ? `${head.get('x-forwarded-proto') ?? 'http'}://${host}` : undefined
    const cookieStore = await cookies()
    const ga = gaSessionFromCookies((name) => cookieStore.get(name)?.value)
    const datafast = dataFastSessionFromCookies((name) => cookieStore.get(name)?.value)
    const result = await startCheckout(user.id, user.email, plan, origin, ga, datafast)
    if ('updated' in result) {
      // Existing subscriber repriced in place — no Stripe URL; the webhook syncs
      // the plan once billing loads.
      redirect('/dashboard/billing?checkout=success')
    }
    redirect('url' in result ? result.url : '/dashboard/billing?error=unconfigured')
  }

  // Guest (anonymous): register inline, then this page re-runs and proceeds.
  return <CheckoutSignup plan={plan} />
}
