import type { ISiteRow } from '@/components/dashboard/tracked-sites-client'
import { getTranslations } from 'next-intl/server'
import { isScanReport } from '@isreadyai/scanner'
import { createServiceClient } from '@isreadyai/supabase'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { TrackedSitesClient } from '@/components/dashboard/tracked-sites-client'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'
import { resolveEntitlements } from '@/lib/entitlements'
import { planOrFree } from '@/lib/plans'

export const dynamic = 'force-dynamic'

interface ILatestScan {
  overall: number | null
  failed: number
  warned: number
  isDeep: boolean
  isSmart: boolean
  createdAt: string
}

export default async function DashboardMyWebsitesPage() {
  const t = await getTranslations('admin')
  const supabase = await createServerSupabaseClient()
  const ctx = await resolveWorkspaceContext()
  const workspaceId = ctx?.workspaceId ?? null
  const entitlements = resolveEntitlements(planOrFree(ctx?.ownerPlan))

  let rows: ISiteRow[] = []
  if (workspaceId !== null) {
    const service = await createServiceClient()
    const [{ data: domainRows }, { data: scanRows }] = await Promise.all([
      supabase
        .from('websites')
        .select('id, host, status, monitoring_enabled, verified_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      service
        .from('scans')
        .select('url, created_at, report, overall_score, has_deep, has_smart')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
    ])

    // Most recent scan per host (scans are already newest-first).
    const latestByHost = new Map<string, ILatestScan>()
    for (const scan of scanRows ?? []) {
      const host = hostOf(scan.url)
      if (latestByHost.has(host)) continue
      const report = isScanReport(scan.report) ? scan.report : null
      latestByHost.set(host, {
        overall: scan.overall_score ?? report?.overall ?? null,
        failed: report?.checks.filter((c) => c.status === 'fail').length ?? 0,
        warned: report?.checks.filter((c) => c.status === 'warn').length ?? 0,
        isDeep: scan.has_deep,
        isSmart: scan.has_smart,
        createdAt: scan.created_at,
      })
    }

    const domains = domainRows ?? []
    const ids = domains.map((d) => d.id)
    const schedulesByDomain = new Map<
      string,
      { nextRunAt: string | null; pausedAt: string | null }
    >()
    if (ids.length > 0) {
      const { data: schedules } = await supabase
        .from('monitoring_schedules')
        .select('website_id, next_run_at, paused_at')
        .in('website_id', ids)
      for (const s of schedules ?? []) {
        schedulesByDomain.set(s.website_id, { nextRunAt: s.next_run_at, pausedAt: s.paused_at })
      }
    }

    rows = domains.map((domain) => {
      const latest = latestByHost.get(domain.host)
      const schedule = schedulesByDomain.get(domain.id)
      const nextCheckAt =
        domain.monitoring_enabled && schedule?.pausedAt === null
          ? (schedule?.nextRunAt ?? null)
          : null
      return {
        id: domain.id,
        host: domain.host,
        verifiedAt: domain.verified_at,
        monitoringEnabled: domain.monitoring_enabled,
        overall: latest?.overall ?? null,
        failed: latest?.failed ?? 0,
        warned: latest?.warned ?? 0,
        isDeep: latest?.isDeep ?? false,
        isSmart: latest?.isSmart ?? false,
        lastScanAt: latest?.createdAt ?? null,
        nextCheckAt,
      }
    })
  }

  return (
    <DashboardPage title={t('domains')} description={t('domainsDescription')}>
      <TrackedSitesClient
        sites={rows}
        canAddMore={rows.length < entitlements.maxDomains}
        limit={entitlements.maxDomains}
      />
    </DashboardPage>
  )
}
