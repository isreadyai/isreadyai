import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@isreadyai/supabase'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { ReportView } from '@/components/report/report-view'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { signProxyToken } from '@/lib/proxy-token'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'
import { isPaidPlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export default async function SiteScanDetailPage({
  params,
}: {
  params: Promise<{ id: string; scanId: string }>
}) {
  const { id, scanId } = await params
  const t = await getTranslations('admin')

  const ctx = await resolveWorkspaceContext()
  if (ctx === null) {
    redirect(`/report/${scanId}`)
  }

  // The website (RLS-scoped to the workspace) anchors the breadcrumb trail.
  const supabase = await createServerSupabaseClient()
  const { data: site } = await supabase.from('websites').select('host').eq('id', id).maybeSingle()
  if (site === null) {
    notFound()
  }

  // Service read: a teammate's scan is user-keyed and hidden by RLS, so we
  // authorize by workspace membership — its owner must be an active member.
  const service = await createServiceClient()
  const { data: scan } = await service
    .from('scans')
    .select('id, url, user_id, workspace_id, created_at')
    .eq('id', scanId)
    .maybeSingle()
  if (scan === null) {
    notFound()
  }
  const fromWorkspace = scan.workspace_id !== null && scan.workspace_id === ctx.workspaceId
  if (!fromWorkspace && scan.user_id !== ctx.userId) {
    // Another workspace's or an anonymous scan: show the public report, not a 404.
    redirect(`/report/${scanId}`)
  }

  // Entitlements follow the workspace owner's plan, not the viewer's personal one
  // — a member of a paid team is premium even when their own profile is free.
  const premium = isPaidPlan(ctx.ownerPlan)
  const proxyToken = signProxyToken(hostOf(scan.url))

  return (
    <DashboardPage
      title={new Date(scan.created_at).toLocaleString()}
      parents={[
        { label: t('domains'), href: '/dashboard/websites' },
        { label: site.host, href: `/dashboard/websites/${id}` },
      ]}
    >
      <ReportView
        key={scanId}
        id={scanId}
        context="dashboard"
        premium={premium}
        websiteId={id}
        proxyToken={proxyToken}
      />
    </DashboardPage>
  )
}
