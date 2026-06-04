import type { ReactNode } from 'react'
import type { IWorkspaceOption } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { BillingBanner } from '@/components/dashboard/billing-banner'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSubscriptionSummary, recommendedCta } from '@/lib/subscription'
import { getActiveWorkspaceId, isWorkspaceManager, listWorkspaceOptions } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Treat any auth failure (no session, or Supabase not configured) as
  // unauthenticated and send them to /login — never surface a 500 here.
  // redirect() throws NEXT_REDIRECT, so it must stay OUTSIDE the try/catch.
  let signedIn = false
  let needsConsent = false
  let banner: ReactNode = null
  let workspaces: IWorkspaceOption[] = []
  let activeWorkspaceId: string | null = null
  let canManageWorkspace = false
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user !== null) {
      signedIn = true
      // Account-wide billing alert: the banner self-hides on healthy states.
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'plan, subscription_status, subscription_current_period_end, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, terms_accepted_at',
        )
        .eq('id', user.id)
        .maybeSingle()
      // Consent gate: anyone who never accepted Terms/Privacy (e.g. social sign-in,
      // which has no metadata to seed it) is sent to /welcome before they can use
      // the app. /welcome lives outside this route group, so no redirect loop.
      needsConsent = profile === null || profile.terms_accepted_at === null
      const summary = getSubscriptionSummary({
        plan: profile?.plan,
        subscription_status: profile?.subscription_status,
        subscription_current_period_end: profile?.subscription_current_period_end,
        stripe_customer_id: profile?.stripe_customer_id,
        stripe_subscription_id: profile?.stripe_subscription_id,
        cancel_at_period_end: profile?.cancel_at_period_end,
      })
      banner = (
        <BillingBanner
          severity={summary.severity}
          uiState={summary.uiState}
          cta={recommendedCta(summary)}
          scope="shell"
        />
      )
      workspaces = await listWorkspaceOptions(supabase, user.id)
      activeWorkspaceId = await getActiveWorkspaceId(supabase, user.id)
      canManageWorkspace = isWorkspaceManager(
        workspaces.find((w) => w.id === activeWorkspaceId)?.role ?? null,
      )
    }
  } catch {
    signedIn = false
  }

  if (!signedIn) {
    redirect('/login')
  }
  if (needsConsent) {
    // This layout only wraps /dashboard/*, so /dashboard is the right place to
    // land after consenting; the exact sub-path isn't recoverable server-side.
    redirect(`/welcome?next=${encodeURIComponent('/dashboard')}`)
  }

  return (
    <DashboardShell
      banner={banner}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      canManageWorkspace={canManageWorkspace}
    >
      {children}
    </DashboardShell>
  )
}
