import { allChecks, isScanReport, scan, scanSite } from '@isreadyai/scanner'
import type { IScanReport } from '@isreadyai/scanner'
import type { Json } from '@isreadyai/supabase'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { sendScoreDropEmail } from '@/lib/email-monitoring'
import { resolveEntitlements, type IEntitlements } from '@/lib/entitlements'
import { materializeScanSummary } from '@/lib/scan-store'
import { runWebSmartAgentAudit } from '@/lib/smart-agent/run-smart-agent'
import { runWebSmartDeepAudit } from '@/lib/smart-agent/run-smart-deep'
import { normalizeHost } from '@/lib/url'
import { ownerPlanForWorkspace } from '@/lib/workspace'

// MARK: - GET /api/cron/scan-domains — scheduled re-scans (the badge engine)

/**
 * Scans on a schedule so badges and monitoring read FRESH persisted scores
 * without any public GET ever triggering an outbound scan (see badge-score.ts).
 * Picks due monitoring_schedules and honours each one's settings: scan_mode
 * ('deep' adds the multi-page crawl) and smart_agent_enabled (the browser-
 * capable Smart Agent pass, plus its Deep scan when both are on). Stores the
 * result and advances next_run_at. Protected by CRON_SECRET (Vercel Cron sends
 * it as a Bearer token automatically when the env var is set).
 */

export const maxDuration = 300

const BATCH = 10
// Smart/deep passes use a real browser and are slow; stop starting new domains
// past this so the function returns cleanly. Anything left stays due next tick.
const TIME_BUDGET_MS = 270_000
const DEEP_LIMIT = 10
// Default drop sensitivity when a schedule has no per-domain alert_delta: a fall
// of >= this many points vs the previous monitored scan fires a "score dropped"
// alert even when the score is still above alert_threshold.
const ALERT_DROP_DELTA = 10
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const INTERVAL_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: WEEK_MS,
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ ran: 0, reason: 'no_persistence' })
  }

  const client = await createServiceClient()
  const startedMs = Date.now()
  const nowIso = new Date(startedMs).toISOString()

  // Re-resolve each owner's CURRENT plan (cached per workspace): a downgrade must
  // stop the paid deep crawl + Smart Agent passes even while stale schedules,
  // created while the workspace still paid, keep requesting them.
  const entCache = new Map<string, IEntitlements>()
  const entitlementsFor = async (workspaceId: string): Promise<IEntitlements> => {
    const cached = entCache.get(workspaceId)
    if (cached !== undefined) {
      return cached
    }
    const ent = resolveEntitlements(await ownerPlanForWorkspace(client, workspaceId))
    entCache.set(workspaceId, ent)
    return ent
  }

  const { data: due } = await client
    .from('monitoring_schedules')
    .select(
      'id, website_id, frequency, alert_threshold, alert_delta, scan_mode, smart_agent_enabled',
    )
    .is('paused_at', null)
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .limit(BATCH)

  // Group due schedules by canonical host: a host tracked by N workspaces is
  // scanned ONCE per tick and the result fanned out to each website's row, so
  // duplicates never trigger N expensive crawls.
  const groups = new Map<string, { url: string; entries: IScheduleEntry[] }>()
  for (const schedule of due ?? []) {
    const { data: website } = await client
      .from('websites')
      .select('host, workspace_id, created_by')
      .eq('id', schedule.website_id)
      .maybeSingle()
    if (website === null) {
      continue
    }
    // Gate the heavy passes on the workspace's plan NOW, not on the schedule's
    // stored flags: deep crawl needs monitoring, Smart Agent needs smartAgent.
    const ent = await entitlementsFor(website.workspace_id)
    const host = normalizeHost(website.host)
    const group = groups.get(host) ?? { url: `https://${host}`, entries: [] }
    group.entries.push({
      schedule,
      website,
      deep: schedule.scan_mode === 'deep' && ent.monitoringEnabled,
      smart: schedule.smart_agent_enabled !== false && ent.smartAgent,
    })
    groups.set(host, group)
  }

  let ran = 0
  for (const [, group] of groups) {
    if (Date.now() - startedMs > TIME_BUDGET_MS) {
      break
    }
    // Union of the group's PLAN-GATED settings: a host tracked by several
    // workspaces runs each heavy pass once if any still-paying schedule wants it.
    const deep = group.entries.some((e) => e.deep)
    const smart = group.entries.some((e) => e.smart)
    try {
      const report = await scan(group.url, { checks: allChecks })
      if (report.meta.fetchOk) {
        const heavy = await computeHeavy(group.url, report.finalUrl, { deep, smart })
        for (const entry of group.entries) {
          await persistScheduledScan(client, entry, group.url, report, heavy)
        }
      }
    } catch {
      // A single host failing must not stall the rest of the batch.
    }

    for (const { schedule } of group.entries) {
      const interval = INTERVAL_MS[schedule.frequency] ?? WEEK_MS
      // Best-effort: a failed next_run_at advance must not abort the cron response.
      await client
        .from('monitoring_schedules')
        .update({ next_run_at: new Date(Date.now() + interval).toISOString() })
        .eq('id', schedule.id)
      ran += 1
    }
  }

  return Response.json({ ran })
}

// MARK: - internal

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

interface IScheduleEntry {
  schedule: {
    id: string
    website_id: string
    frequency: string
    alert_threshold: number | null
    alert_delta: number | null
    scan_mode: string | null
    smart_agent_enabled: boolean | null
  }
  website: { host: string; workspace_id: string; created_by: string | null }
  // Plan-gated effective passes for this schedule's workspace, re-resolved per tick.
  deep: boolean
  smart: boolean
}

type THeavy = Awaited<ReturnType<typeof computeHeavy>>

/**
 * Runs a host's slow shared passes ONCE: the deep crawl and the browser-capable
 * Smart Agent (single-page, plus its deep pass when both are wanted). Results are
 * stored per-schedule by persistScheduledScan, so a host tracked by several
 * workspaces is crawled a single time. Each stage is best-effort.
 */
async function computeHeavy(
  url: string,
  finalUrl: string,
  flags: { deep: boolean; smart: boolean },
): Promise<{
  siteReport: Awaited<ReturnType<typeof scanSite>> | null
  smartReport: Awaited<ReturnType<typeof runWebSmartAgentAudit>> | null
  smartSite: Awaited<ReturnType<typeof runWebSmartDeepAudit>> | null
}> {
  let siteReport: Awaited<ReturnType<typeof scanSite>> | null = null
  let smartReport: Awaited<ReturnType<typeof runWebSmartAgentAudit>> | null = null
  let smartSite: Awaited<ReturnType<typeof runWebSmartDeepAudit>> | null = null
  if (flags.deep) {
    try {
      siteReport = await scanSite(url, { checks: allChecks, limit: DEEP_LIMIT })
    } catch {
      siteReport = null
    }
  }
  if (flags.smart) {
    try {
      smartReport = await runWebSmartAgentAudit(finalUrl)
    } catch {
      smartReport = null
    }
    if (flags.deep && siteReport !== null && smartReport !== null) {
      try {
        smartSite = await runWebSmartDeepAudit(siteReport)
      } catch {
        // The single-page Smart Agent already landed; the deep pass is a bonus.
      }
    }
  }
  return { siteReport, smartReport, smartSite }
}

/**
 * Persists one scheduled scan row from the shared host report + heavy passes,
 * honouring THIS schedule's plan-gated deep/smart flags, then advances the badge
 * pointer, fires alerts, and materializes the summary. Best-effort per row.
 */
async function persistScheduledScan(
  client: TServiceClient,
  entry: IScheduleEntry,
  url: string,
  report: IScanReport,
  heavy: THeavy,
): Promise<void> {
  // deep/smart are the plan-gated flags resolved in GET, so a downgraded
  // workspace's row records the passes as disabled rather than failed.
  const { schedule, website, deep, smart } = entry

  // Previous monitored score BEFORE inserting, so maybeAlert can detect a drop.
  const { data: prevScan } = await client
    .from('scans')
    .select('report')
    .eq('website_id', schedule.website_id)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const previousOverall = isScanReport(prevScan?.report) ? prevScan.report.overall : null

  const scanId = crypto.randomUUID()
  const { error } = await client.from('scans').insert({
    id: scanId,
    url,
    status: 'done',
    report: report as unknown as Json,
    source: 'cron',
    smart_status: smart ? (heavy.smartReport !== null ? 'done' : 'failed') : 'disabled',
    smart_report:
      smart && heavy.smartReport !== null ? (heavy.smartReport as unknown as Json) : null,
    smart_error: smart && heavy.smartReport === null ? 'agent_browser_failed' : null,
    site_report: deep && heavy.siteReport !== null ? (heavy.siteReport as unknown as Json) : null,
    smart_site_report:
      deep && smart && heavy.smartSite !== null ? (heavy.smartSite as unknown as Json) : null,
    user_id: website.created_by,
    workspace_id: website.workspace_id,
    website_id: schedule.website_id,
    created_at: new Date().toISOString(),
  })
  if (error !== null) {
    return
  }
  // Best-effort: a failed public_report_id update must not fail the domain scan.
  await client.from('websites').update({ public_report_id: scanId }).eq('id', schedule.website_id)
  await maybeAlert(client, schedule, website, report, scanId, previousOverall)
  await materializeScanSummary(client, scanId)
}

async function maybeAlert(
  client: TServiceClient,
  schedule: { website_id: string; alert_threshold: number | null; alert_delta: number | null },
  domain: { host: string; workspace_id: string; created_by: string | null },
  report: IScanReport,
  scanId: string,
  previousOverall: number | null,
): Promise<void> {
  const overall = report.overall
  const threshold = schedule.alert_threshold
  // Per-domain drop sensitivity (monitoring_schedules.alert_delta), default 10.
  const dropDelta = schedule.alert_delta ?? ALERT_DROP_DELTA

  // Alert when the score NEWLY crosses below the threshold (dedup: not re-fired
  // every tick while it stays low), OR when it falls sharply vs the previous
  // monitored scan (a real loss of score, even while above the threshold).
  const crossedBelow =
    threshold !== null &&
    overall < threshold &&
    (previousOverall === null || previousOverall >= threshold)
  const droppedSharply = previousOverall !== null && previousOverall - overall >= dropDelta
  if (!crossedBelow && !droppedSharply) {
    return
  }

  // The owner's global switch (notification_preferences '*' row) gates each
  // channel independently: in_app for the inbox, email for the Resend alert.
  let pref: { in_app: boolean; email: boolean } | null = null
  if (domain.created_by !== null) {
    const { data } = await client
      .from('notification_preferences')
      .select('in_app, email')
      .eq('user_id', domain.created_by)
      .eq('event_type', '*')
      .maybeSingle()
    pref = data
  }

  const delta = previousOverall === null ? 0 : previousOverall - overall
  const body =
    droppedSharply && crossedBelow
      ? `Down ${delta} pts from ${previousOverall}/100 — below your alert threshold of ${threshold}.`
      : droppedSharply
        ? `Down ${delta} pts from ${previousOverall}/100 since the last check.`
        : `Below your alert threshold of ${threshold}.`

  if (pref?.in_app !== false) {
    // Best-effort: a failed notification insert must not fail the alert engine.
    await client.from('notifications').insert({
      workspace_id: domain.workspace_id,
      type: 'score_drop',
      severity: 'warning',
      resource_type: 'domain',
      resource_id: schedule.website_id,
      title: `${domain.host} dropped to ${overall}/100`,
      body,
    })
  }

  // Email the owner the dropped report (PDF + LLM .md). Best-effort.
  if (pref?.email !== false && domain.created_by !== null) {
    const { data: profile } = await client
      .from('profiles')
      .select('email')
      .eq('id', domain.created_by)
      .maybeSingle()
    const email = profile?.email ?? ''
    if (email !== '') {
      await sendScoreDropEmail(email, report, scanId, domain.host, {
        threshold,
        previousOverall,
      }).catch(() => false)
    }
  }
}
