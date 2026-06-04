import { gradeOf, isScanReport } from '@isreadyai/scanner'
import type { Tables } from '@isreadyai/supabase'
import { createServiceClient } from '@isreadyai/supabase'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { AdminMetricCard } from '@/components/admin/admin-metric-card'
import { ScansTable, type IScanRow } from '@/components/dashboard/scans-table'
import {
  MonitoredSitesTable,
  type IMonitoredSiteRow,
} from '@/components/dashboard/monitored-sites-table'
import { ScoreSparkline } from '@/components/dashboard/score-sparkline'
import { OnboardingPanel } from '@/components/dashboard/onboarding-panel'
import { PlanIcon } from '@/components/ui/plan-icon'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { EmptyState } from '@/components/ui/empty-state'
import { PageBanner, EPageBannerSeverity } from '@/components/ui/page-banner'
import { isPaidPlan, PLAN_FIX_QUOTA, planOrFree } from '@/lib/plans'
import { EScanStatus } from '@/lib/scan-record'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'
import { resolveWorkspaceContext } from '@/lib/workspace-context'

export const dynamic = 'force-dynamic'

const QUOTA_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Dashboard overview with recent scans, monitored sites, and quota tracking. */
export default async function DashboardOverviewPage() {
  const t = await getTranslations('admin')
  const td = await getTranslations('dashboard')
  const ctx = await resolveWorkspaceContext()
  const workspaceId = ctx?.workspaceId ?? null
  const plan = planOrFree(ctx?.ownerPlan)

  const supabase = await createServerSupabaseClient()
  const service = await createServiceClient()

  // scans, api keys and notifications all belong to the active workspace; RLS
  // alone would count notifications across every workspace, so scope explicitly.
  const [scansResult, keysResult, alertsResult] = await Promise.all([
    workspaceId === null
      ? Promise.resolve(null)
      : service
          .from('scans')
          .select('id, url, status, created_at, report, overall_score, has_deep, has_smart')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
    workspaceId === null
      ? Promise.resolve(null)
      : service
          .from('api_keys')
          .select('id')
          .eq('workspace_id', workspaceId)
          .is('revoked_at', null),
    workspaceId === null
      ? Promise.resolve(null)
      : supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .is('read_at', null),
  ])
  const unreadAlerts = alertsResult?.count ?? 0
  const scans = scansResult?.data ?? []
  // Newest-first; reuse for the recent list, trend and per-host latest score.
  const doneScores = scans.flatMap((scan) => {
    if (scan.status !== EScanStatus.DONE) {
      return []
    }
    const report = isScanReport(scan.report) ? scan.report : null
    const score = scan.overall_score ?? report?.overall ?? null
    return score !== null ? [score] : []
  })
  const averageScore =
    doneScores.length > 0
      ? Math.round(doneScores.reduce((sum, n) => sum + n, 0) / doneScores.length)
      : null
  // Oldest → newest dated combined scores for the trend chart (cap the window).
  const trendPoints = scans
    .flatMap((scan) => {
      if (scan.status !== EScanStatus.DONE) {
        return []
      }
      const report = isScanReport(scan.report) ? scan.report : null
      const score = scan.overall_score ?? report?.overall ?? null
      return score !== null ? [{ score, at: scan.created_at }] : []
    })
    .slice(0, 24)
    .toReversed()

  const recentScans: IScanRow[] = scans.slice(0, 5).map((scan) => {
    const report = isScanReport(scan.report) ? scan.report : null
    const overall = scan.overall_score ?? report?.overall ?? null
    return {
      id: scan.id,
      host: hostOf(scan.url),
      status: scan.status,
      createdAt: scan.created_at,
      overall,
      grade: overall === null ? null : gradeOf(overall),
      failed: report?.checks.filter((c) => c.status === 'fail').length ?? 0,
      warned: report?.checks.filter((c) => c.status === 'warn').length ?? 0,
      isDeep: scan.has_deep,
      isSmart: scan.has_smart,
    }
  })

  // Latest combined score per host (scans are newest-first, so first wins).
  const latestByHost = new Map<string, number | null>()
  for (const scan of scans) {
    const host = hostOf(scan.url)
    if (!latestByHost.has(host)) {
      const report = isScanReport(scan.report) ? scan.report : null
      latestByHost.set(host, scan.overall_score ?? report?.overall ?? null)
    }
  }

  let monitoredSites = 0
  let sites: IMonitoredSiteRow[] = []
  if (workspaceId !== null) {
    const { data: siteRows } = await supabase
      .from('websites')
      .select('id, host, monitoring_enabled')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    monitoredSites = siteRows?.length ?? 0
    const ids = (siteRows ?? []).map((s) => s.id)
    const nextBySite = new Map<string, string | null>()
    if (ids.length > 0) {
      const { data: schedules } = await supabase
        .from('monitoring_schedules')
        .select('website_id, next_run_at, paused_at')
        .in('website_id', ids)
      for (const s of schedules ?? []) {
        nextBySite.set(s.website_id, s.paused_at === null ? s.next_run_at : null)
      }
    }
    sites = (siteRows ?? []).slice(0, 5).map((s) => ({
      id: s.id,
      host: s.host,
      overall: latestByHost.get(s.host) ?? null,
      nextCheckAt: s.monitoring_enabled ? (nextBySite.get(s.id) ?? null) : null,
    }))
  }

  const keyIds = (keysResult?.data ?? []).map((k) => k.id)
  const fixRunsUsed = await countFixRuns(keyIds)
  const fixLimit = PLAN_FIX_QUOTA[plan]

  return (
    <DashboardPage title={t('overview')}>
      <div className="space-y-6">
        <OnboardingPanel isPaid={isPaidPlan(plan)} />

        {unreadAlerts > 0 ? (
          <PageBanner
            severity={EPageBannerSeverity.WARNING}
            title={td('overviewAlertsTitle', { count: unreadAlerts })}
            description={td('overviewAlertsBody')}
            action={
              <Link
                href="/dashboard/alerts"
                className="text-site-accent text-sm font-medium hover:underline"
              >
                {td('overviewAlertsCta')}
              </Link>
            }
          />
        ) : null}

        <div className="grid gap-6 2xl:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminMetricCard
              label={t('totalScans')}
              value={String(scans.length)}
              detail={td('scansDetail')}
            />
            <AdminMetricCard
              label={td('overviewSites')}
              value={String(monitoredSites)}
              detail={td('overviewSitesDetail')}
            />
            <AdminMetricCard
              label={t('fixRuns')}
              value={`${fixRunsUsed} / ${fixLimit}`}
              detail={td('fixRunsDetail')}
            />
            <AdminMetricCard
              label={td('planLabel')}
              value={
                <span
                  className={`flex items-center gap-2 uppercase ${isPaidPlan(plan) ? 'text-site-secondary' : ''}`}
                >
                  <PlanIcon plan={plan} className="size-6" />
                  {plan}
                </span>
              }
              detail={td('planDetail')}
            />
          </div>

          <section className="border-site-border bg-site-surface/60 flex flex-col rounded-2xl border p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{td('overviewTrendTitle')}</h2>
              {averageScore !== null ? (
                <span className="text-site-secondary font-mono text-sm font-semibold">
                  {averageScore}
                  <span className="text-site-faint">/100 avg</span>
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex min-h-32 flex-1 flex-col">
              {trendPoints.length >= 2 ? (
                <ScoreSparkline points={trendPoints} />
              ) : (
                <p className="text-site-faint m-auto text-center text-xs">
                  {td('overviewTrendEmpty')}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="border-site-border bg-site-surface/60 min-w-0 rounded-2xl border p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{td('overviewRecentTitle')}</h2>
              <Link
                href="/dashboard/scans"
                className="text-site-muted hover:text-site-accent text-xs transition-colors"
              >
                {td('overviewSeeAll')}
              </Link>
            </div>
            {recentScans.length === 0 ? (
              <div className="mt-4">
                <EmptyState title={td('overviewRecentEmpty')} />
              </div>
            ) : (
              <div className="mt-4">
                <ScansTable rows={recentScans} searchable={false} fill={false} />
              </div>
            )}
          </section>

          <section className="border-site-border bg-site-surface/60 min-w-0 rounded-2xl border p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{td('overviewMonitoredTitle')}</h2>
              <Link
                href="/dashboard/websites"
                className="text-site-muted hover:text-site-accent text-xs transition-colors"
              >
                {td('overviewSeeAll')}
              </Link>
            </div>
            {sites.length === 0 ? (
              <div className="mt-4">
                <EmptyState title={td('overviewMonitoredEmpty')} />
              </div>
            ) : (
              <div className="mt-4">
                <MonitoredSitesTable rows={sites} />
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardPage>
  )
}

async function countFixRuns(keyIds: Tables<'api_keys'>['id'][]): Promise<number> {
  if (keyIds.length === 0) {
    return 0
  }
  const service = await createServiceClient()
  const since = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString()
  const { count } = await service
    .from('fix_runs')
    .select('id', { count: 'exact', head: true })
    .in('api_key_id', keyIds)
    .gte('created_at', since)
  return count ?? 0
}
