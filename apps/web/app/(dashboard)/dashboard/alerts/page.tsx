import type { INotification } from '@/components/dashboard/alerts-client'
import { getTranslations } from 'next-intl/server'
import { AlertsClient } from '@/components/dashboard/alerts-client'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardAlertsPage() {
  const t = await getTranslations('admin')
  const ctx = await resolveWorkspaceContext()
  const supabase = await createServerSupabaseClient()

  // Scope to the ACTIVE workspace: RLS alone would surface notifications from
  // every workspace the user belongs to, ignoring the switcher.
  const { data } =
    ctx === null
      ? { data: null }
      : await supabase
          .from('notifications')
          .select('id, severity, title, body, created_at, read_at')
          .eq('workspace_id', ctx.workspaceId)
          .order('created_at', { ascending: false })
          .limit(50)

  const notifications: INotification[] = (data ?? []).map((row) => ({
    id: row.id,
    severity: row.severity,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }))

  return (
    <DashboardPage title={t('alerts')} description={t('alertsDescription')}>
      <AlertsClient notifications={notifications} />
    </DashboardPage>
  )
}
