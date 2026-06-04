import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@isreadyai/supabase'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { ReportView } from '@/components/report/report-view'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { signProxyToken } from '@/lib/proxy-token'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'
import { websiteIdForScanUrl } from '@/lib/website-for-scan'
import { isPaidPlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export default async function DashboardScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('admin')

  const ctx = await resolveWorkspaceContext()
  if (ctx === null) {
    redirect(`/report/${id}`)
  }

  // Service read: a teammate's scan is user-keyed and hidden by RLS, so we
  // authorize by workspace membership — its owner must be an active member.
  const service = await createServiceClient()
  const { data: scan } = await service
    .from('scans')
    .select('id, url, user_id, workspace_id')
    .eq('id', id)
    .maybeSingle()
  if (scan === null) {
    notFound()
  }
  const fromWorkspace = scan.workspace_id !== null && scan.workspace_id === ctx.workspaceId
  if (!fromWorkspace && scan.user_id !== ctx.userId) {
    // Another workspace's or an anonymous scan: show the public report, not a 404.
    redirect(`/report/${id}`)
  }

  const premium = isPaidPlan(ctx.ownerPlan)
  const supabase = await createServerSupabaseClient()
  const websiteId = await websiteIdForScanUrl(supabase, scan.url)
  const proxyToken = signProxyToken(hostOf(scan.url))

  return (
    <DashboardPage
      title={hostOf(scan.url)}
      parents={[{ label: t('scans'), href: '/dashboard/scans' }]}
    >
      <ReportView
        key={id}
        id={id}
        context="dashboard"
        premium={premium}
        websiteId={websiteId}
        proxyToken={proxyToken}
      />
    </DashboardPage>
  )
}
