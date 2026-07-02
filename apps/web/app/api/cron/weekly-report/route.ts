import { isScanReport } from '@isreadyai/scanner'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { sendWeeklyReportEmail } from '@/lib/email-monitoring'

// MARK: - GET /api/cron/weekly-report — weekly per-site report emails
//
// Emails each monitored site's latest report (PDF + LLM .md) to the workspace's
// active members who haven't opted out. last_weekly_report_at makes a re-run or
// a double-fire within the week a no-op. Protected by CRON_SECRET.

export const maxDuration = 300

const BATCH = 25
const STALE_MS = 6 * 24 * 60 * 60 * 1000

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ sent: 0, reason: 'no_persistence' })
  }

  const client = await createServiceClient()
  const staleIso = new Date(Date.now() - STALE_MS).toISOString()

  const { data: due } = await client
    .from('monitoring_schedules')
    .select('id, website_id, last_weekly_report_at')
    .is('paused_at', null)
    .or(`last_weekly_report_at.is.null,last_weekly_report_at.lte.${staleIso}`)
    .limit(BATCH)

  let sent = 0
  for (const schedule of due ?? []) {
    const { data: site } = await client
      .from('websites')
      .select('host, workspace_id')
      .eq('id', schedule.website_id)
      .maybeSingle()
    if (site === null) {
      continue
    }
    // Newest completed scan that actually produced a report.
    const { data: scanRow } = await client
      .from('scans')
      .select('id, report')
      .eq('website_id', schedule.website_id)
      .eq('status', 'done')
      .not('report', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (scanRow === null || !isScanReport(scanRow.report)) {
      continue
    }

    const recipients = await weeklyRecipients(client, site.workspace_id)
    for (const email of recipients) {
      await sendWeeklyReportEmail(email, scanRow.report, scanRow.id, site.host).catch(() => false)
    }
    await client
      .from('monitoring_schedules')
      .update({ last_weekly_report_at: new Date().toISOString() })
      .eq('id', schedule.id)
    sent += 1
  }

  return Response.json({ sent })
}

// MARK: - internal

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/**
 * Active workspace members who haven't opted out — a notification_preferences
 * row with email=false or digest='off' (global '*' or 'weekly_report' event)
 * excludes them. An absent row means defaults, so silence is consent.
 */
async function weeklyRecipients(client: TServiceClient, workspaceId: string): Promise<string[]> {
  const { data: members } = await client
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) {
    return []
  }

  const { data: prefs } = await client
    .from('notification_preferences')
    .select('user_id, email, digest')
    .eq('workspace_id', workspaceId)
    .in('user_id', userIds)
    .in('event_type', ['*', 'weekly_report'])
  const optedOut = new Set<string>()
  for (const pref of prefs ?? []) {
    if (pref.email === false || pref.digest === 'off') {
      optedOut.add(pref.user_id)
    }
  }

  const { data: profiles } = await client.from('profiles').select('id, email').in('id', userIds)
  const emails: string[] = []
  for (const profile of profiles ?? []) {
    if (!optedOut.has(profile.id) && profile.email !== null && profile.email !== '') {
      emails.push(profile.email)
    }
  }
  return emails
}
