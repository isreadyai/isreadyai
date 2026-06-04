import { getTranslations } from 'next-intl/server'
import { AccountSecurity } from '@/components/dashboard/account-security'
import { BillingPanel } from '@/components/dashboard/billing-panel'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { ProfileNameForm } from '@/components/dashboard/profile-name-form'
import { PlanIcon } from '@/components/ui/plan-icon'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAlertsEnabled } from '@/lib/actions/account'
import { availableOAuthProviders } from '@/lib/oauth-providers'
import { planOrFree } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export default async function DashboardSettingsPage() {
  const t = await getTranslations('admin')
  const td = await getTranslations('dashboard')
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const plan = planOrFree(profile?.plan)
  const alertsEnabled = await getAlertsEnabled()
  const oauthProviders = await availableOAuthProviders()

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const metaString = (key: string): string =>
    typeof meta[key] === 'string' ? (meta[key] as string) : ''
  const initialName = metaString('display_name') || metaString('full_name') || metaString('name')

  return (
    <DashboardPage title={t('settings')} description={t('settingsDescription')}>
      <div className="space-y-6">
        <section className="border-site-border bg-site-surface/60 space-y-5 rounded-2xl border p-6">
          <h2 className="text-sm font-semibold">{td('settingsProfileTitle')}</h2>
          <div className="divide-site-border/60 divide-y">
            <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-site-muted text-xs tracking-wide uppercase">
                {td('displayNameLabel')}
              </p>
              <div className="w-full sm:max-w-md">
                <ProfileNameForm initialName={initialName} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <p className="text-site-muted text-xs tracking-wide uppercase">{td('emailLabel')}</p>
              <p className="text-sm">{user?.email ?? '—'}</p>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <p className="text-site-muted text-xs tracking-wide uppercase">{td('planLabel')}</p>
              <p className="flex items-center gap-2 text-sm">
                <PlanIcon plan={plan} className="size-4" />
                {plan}
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-site-muted text-xs tracking-wide uppercase">
                {td('manageSubscription')}
              </p>
              <div className="shrink-0">
                <BillingPanel plan={plan} />
              </div>
            </div>
          </div>
        </section>

        <AccountSecurity
          email={user?.email ?? ''}
          alertsEnabled={alertsEnabled}
          availableProviders={oauthProviders}
        />
      </div>
    </DashboardPage>
  )
}
