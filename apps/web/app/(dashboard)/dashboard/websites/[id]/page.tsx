import type { IScanRow } from '@/components/dashboard/scans-table'
import type { TScanMode } from '@/lib/actions/domains'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  gradeOf,
  isScanReport,
  isSiteReport,
  isSmartAgentReport,
  isSmartAgentSiteReport,
} from '@isreadyai/scanner'
import { createServiceClient } from '@isreadyai/supabase'
import { AskYourSite } from '@/components/report/ask-your-site'
import { CategoryBar, DeepScanBar, SmartAgentBar } from '@/components/report/category-bar'
import { ScoreRing } from '@/components/report/score-ring'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { MonitoringAlertDelta } from '@/components/dashboard/monitoring-alert-delta'
import { MonitoringAlertThreshold } from '@/components/dashboard/monitoring-alert-threshold'
import { MonitoringModeSwitch } from '@/components/dashboard/monitoring-mode-switch'
import { MonitoringSwitch } from '@/components/dashboard/monitoring-switch'
import { ScansTable } from '@/components/dashboard/scans-table'
import { SiteBadgeEmbed } from '@/components/dashboard/site-badge-embed'
import { SiteDetailControls } from '@/components/dashboard/site-detail-controls'
import { SiteSolutionCard } from '@/components/dashboard/site-solution-card'
import { SmartAgentSwitch } from '@/components/dashboard/smart-agent-switch'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'
import { combinedScoreFromRow, deepTrackScore, smartTrackScore } from '@/lib/score'
import { SITE_URL } from '@/lib/site'
import { isPaidPlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const MONITOR_SCAN_MODES: readonly TScanMode[] = ['simple', 'deep']

function isMonitorScanMode(value: unknown): value is TScanMode {
  return typeof value === 'string' && (MONITOR_SCAN_MODES as readonly string[]).includes(value)
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('admin')
  const td = await getTranslations('dashboard')
  const tr = await getTranslations('report')
  const supabase = await createServerSupabaseClient()
  const ctx = await resolveWorkspaceContext()
  if (ctx === null) {
    notFound()
  }
  const userId = ctx.userId

  // RLS scopes the read to the caller's workspace; a miss means not-found.
  const { data: site } = await supabase
    .from('websites')
    .select('id, host, name, status, monitoring_enabled, verified_at, badge_enabled')
    .eq('id', id)
    .maybeSingle()
  if (site === null) {
    notFound()
  }

  // Scans are workspace-owned: read the whole workspace's history for this site
  // (service client + workspace_id) so team members see the owner's reports, not
  // only their own. Mirrors the scans list and the overview.
  const service = await createServiceClient()
  const [{ data: scanData }, { data: schedule }] = await Promise.all([
    service
      .from('scans')
      .select(
        'id, url, status, created_at, report, smart_status, site_report, smart_report, smart_site_report',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('host', site.host)
      .order('created_at', { ascending: false }),
    supabase
      .from('monitoring_schedules')
      .select(
        'next_run_at, paused_at, scan_mode, smart_agent_enabled, alert_delta, alert_threshold',
      )
      .eq('website_id', id)
      .maybeSingle(),
  ])
  // Premium follows the workspace owner's plan, so members of a Team workspace
  // get the paid features there regardless of their own personal plan.
  const premium = isPaidPlan(ctx.ownerPlan)
  const rawScanMode = schedule?.scan_mode
  const scanMode: TScanMode = isMonitorScanMode(rawScanMode) ? rawScanMode : 'simple'
  const smartAgentEnabled = schedule?.smart_agent_enabled ?? true
  const alertDelta = schedule?.alert_delta ?? 10
  const alertThreshold = schedule?.alert_threshold ?? null

  const rows: IScanRow[] = (scanData ?? []).map((scan) => {
    const report = isScanReport(scan.report) ? scan.report : null
    const overall = combinedScoreFromRow(scan)
    return {
      id: scan.id,
      host: hostOf(scan.url),
      status: scan.status,
      createdAt: scan.created_at,
      overall,
      grade: overall === null ? null : gradeOf(overall),
      failed: report?.checks.filter((c) => c.status === 'fail').length ?? 0,
      warned: report?.checks.filter((c) => c.status === 'warn').length ?? 0,
      isDeep: isSiteReport(scan.site_report),
      isSmart:
        isSmartAgentReport(scan.smart_report) || isSmartAgentSiteReport(scan.smart_site_report),
    }
  })

  const latest = rows.find((r) => r.overall !== null) ?? null
  // Most recent completed scan drives the result card so it's identical to the
  // scan detail (ring + category bars, plus the Deep Scan row when deep).
  const latestScan =
    (scanData ?? []).find(
      (scan) =>
        hostOf(scan.url) === site.host && isScanReport(scan.report) && scan.report.overall !== null,
    ) ?? null
  const latestReport =
    latestScan !== null && isScanReport(latestScan.report) ? latestScan.report : null
  const latestSite =
    latestScan !== null && isSiteReport(latestScan.site_report) ? latestScan.site_report : null
  const deepScore = deepTrackScore(latestSite)
  const smartScore =
    latestScan === null
      ? null
      : smartTrackScore(
          isSmartAgentReport(latestScan.smart_report) ? latestScan.smart_report : null,
          isSmartAgentSiteReport(latestScan.smart_site_report)
            ? latestScan.smart_site_report
            : null,
        )
  const overallScore = latestScan === null ? null : combinedScoreFromRow(latestScan)
  const smartReady = latestScan?.smart_status === 'done'
  const lastScanAt = rows[0]?.createdAt ?? null
  const nextCheckAt =
    site.monitoring_enabled && schedule?.paused_at === null ? (schedule?.next_run_at ?? null) : null

  return (
    <DashboardPage
      title={site.name ?? site.host}
      parents={[{ label: t('domains'), href: '/dashboard/websites' }]}
    >
      <SiteDetailControls
        siteId={site.id}
        host={site.host}
        name={site.name}
        verified={site.verified_at !== null}
        scanMode={scanMode}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {latestReport !== null && overallScore !== null && latestScan !== null ? (
          <div className="border-site-border bg-site-surface/50 hover:border-site-accent-dim @container relative rounded-2xl border p-8 transition-colors">
            <Link
              href={`/dashboard/websites/${id}/scans/${latestScan.id}`}
              aria-label={td('siteOpenLatestScan')}
              className="absolute inset-0 z-0 rounded-2xl"
            />
            <div className="grid items-center gap-8 @md:grid-cols-[auto_1fr]">
              <ScoreRing
                score={overallScore}
                grade={gradeOf(overallScore)}
                label={tr(`grade.${gradeOf(overallScore)}`)}
              />
              <div className="@container space-y-3">
                {latestReport.categories.map((category) => (
                  <CategoryBar key={category.category} category={category} />
                ))}
                {deepScore !== null ? <DeepScanBar score={deepScore} divider /> : null}
                {smartScore !== null ? (
                  <SmartAgentBar score={smartScore} divider={deepScore === null} />
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <section className="border-site-border bg-site-surface/50 flex items-center justify-center rounded-2xl border p-8">
            <div className="border-site-border text-site-faint flex size-40 flex-col items-center justify-center rounded-full border border-dashed text-center text-xs">
              {td('siteNeverScanned')}
            </div>
          </section>
        )}

        <section className="border-site-border bg-site-surface/50 space-y-4 rounded-2xl border p-6">
          <div className="flex flex-wrap gap-2">
            <StatusChip
              on={site.verified_at !== null}
              on_label={td('siteVerified')}
              off_label={td('siteUnverified')}
            />
            <StatusChip
              on={site.monitoring_enabled}
              on_label={td('siteMonitoringOn')}
              off_label={td('siteMonitoringOff')}
            />
          </div>

          <div className="divide-site-border/60 divide-y text-sm">
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-site-faint">{td('siteLastScan')}</span>
              <span className="text-site-text font-mono text-xs">
                {lastScanAt !== null ? new Date(lastScanAt).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-site-faint">{td('colNextCheck')}</span>
              {nextCheckAt === null ? (
                <span className="text-site-text font-mono text-xs">—</span>
              ) : new Date(nextCheckAt).getTime() <= Date.now() ? (
                // Past due: the schedule is overdue (the cron tick hasn't run yet).
                <span className="text-site-accent font-mono text-xs">{td('siteNextDue')}</span>
              ) : (
                <span className="text-site-text font-mono text-xs">
                  {new Date(nextCheckAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="py-2.5">
              <MonitoringSwitch
                siteId={site.id}
                enabled={site.monitoring_enabled}
                premium={premium}
              />
            </div>
            {site.monitoring_enabled ? (
              <>
                <div className="py-2.5">
                  <MonitoringModeSwitch siteId={site.id} mode={scanMode} premium={premium} />
                </div>
                <div className="py-2.5">
                  <SmartAgentSwitch
                    siteId={site.id}
                    enabled={smartAgentEnabled}
                    premium={premium}
                  />
                </div>
                <div className="py-2.5">
                  <MonitoringAlertDelta siteId={site.id} delta={alertDelta} premium={premium} />
                </div>
                <div className="py-2.5">
                  <MonitoringAlertThreshold
                    siteId={site.id}
                    threshold={alertThreshold}
                    premium={premium}
                  />
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>

      {latestReport !== null ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SiteSolutionCard report={latestReport} premium={premium} />
          <SiteBadgeEmbed
            siteId={site.id}
            host={site.host}
            verified={site.verified_at !== null}
            premium={premium}
            enabled={site.badge_enabled}
            siteUrl={SITE_URL}
          />
        </div>
      ) : (
        <SiteBadgeEmbed
          siteId={site.id}
          host={site.host}
          verified={site.verified_at !== null}
          premium={premium}
          enabled={site.badge_enabled}
          siteUrl={SITE_URL}
        />
      )}

      <h2 className="text-sm font-medium">{td('siteDetailHistory')}</h2>
      {rows.length === 0 ? (
        <EmptyState
          title={td('siteDetailEmpty')}
          action={<Button href="/dashboard/scans">{td('siteDetailScanCta')}</Button>}
        />
      ) : (
        <ScansTable rows={rows} basePath={`/dashboard/websites/${id}/scans`} fill={false} />
      )}

      {latest !== null ? (
        <AskYourSite
          scanId={latest.id}
          websiteId={site.id}
          isReady={smartReady}
          authenticated={userId !== ''}
          premium={premium}
          smartScore={smartScore}
          readinessScore={overallScore}
        />
      ) : null}
    </DashboardPage>
  )
}

// MARK: - Status chip (mirrors the list chips)

function StatusChip({
  on,
  on_label,
  off_label,
}: {
  on: boolean
  on_label: string
  off_label: string
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs ${
        on ? 'border-site-accent/45 text-site-accent' : 'border-site-border text-site-faint'
      }`}
    >
      {on ? on_label : off_label}
    </span>
  )
}
