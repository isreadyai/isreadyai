import type { TGrade } from '@isreadyai/scanner'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { gradeOf, isScanReport } from '@isreadyai/scanner'
import { isPaidPlan } from '@/lib/plans'
import { combinedScoreFromRow } from '@/lib/score'
import { hostOf, normalizeHost as canonicalHost } from '@/lib/url'
import { ownerPlanForWorkspace } from '@/lib/workspace'

// MARK: - Persisted badge score

export interface IBadgeScore {
  score: number | null
  grade: TGrade | null
}

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/**
 * Tokenless badge score for a host that is a VERIFIED tracked domain. Proven DNS
 * ownership is the authorization — no signed token — so `/badge/<host>` just works
 * for anyone once the owner verifies. Entitlement follows the WORKSPACE OWNER's
 * plan (not the domain creator's), and the score is read from the workspace's own
 * scans: a pinned `public_report_id` wins, else the latest completed scan of the
 * host across the workspace's members. Returns null when the host is not a
 * badge-activated, premium, verified domain (the caller renders the locked badge).
 *
 * The badge reads persisted scans instead of scanning live, so viewing it never
 * triggers an outbound fetch — closing the DDoS-amplification / SSRF surface a
 * live-on-GET badge would open.
 */
export async function verifiedDomainBadgeScore(host: string): Promise<IBadgeScore | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  const client = await createServiceClient()
  // `websites.host` is stored canonicalized (lowercased, leading `www.` stripped —
  // see addTrackedDomain), so the lookup must canonicalize the requested host the
  // SAME way. Otherwise `/badge/www.deluisa.bio` or a mixed-case host misses the
  // row and a verified/paid site wrongly falls through to the locked badge.
  const { data: domain } = await client
    .from('websites')
    .select('workspace_id, badge_enabled, public_report_id')
    .eq('host', canonicalHost(host))
    .not('verified_at', 'is', null)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  // A verified domain alone is NOT enough — the badge is a Pro/Team feature the
  // owner must explicitly activate, on a paid workspace.
  if (domain === null || domain.workspace_id === null || domain.badge_enabled !== true) {
    return null
  }
  if (!isPaidPlan(await ownerPlanForWorkspace(client, domain.workspace_id))) {
    return null
  }
  if (domain.public_report_id !== null) {
    const pinned = await scoreForScanId(client, domain.public_report_id, host)
    if (pinned !== null) {
      return pinned
    }
  }
  return scoreForWorkspaceHost(client, domain.workspace_id, host)
}

// MARK: - internal

/** Score of one specific scan, when it's completed and its host matches. */
async function scoreForScanId(
  client: TServiceClient,
  scanId: string,
  host: string,
): Promise<IBadgeScore | null> {
  const { data: row } = await client
    .from('scans')
    .select('report, site_report, smart_report, smart_site_report')
    .eq('id', scanId)
    .eq('status', 'done')
    .maybeSingle()
  if (row === null || !isScanReport(row.report)) {
    return null
  }
  if (normalizeHost(hostOf(row.report.finalUrl)) !== normalizeHost(host)) {
    return null
  }
  const score = combinedScoreFromRow(row)
  return { score, grade: score === null ? null : gradeOf(score) }
}

/** Most recent completed scan score for a host, across a workspace's members. */
async function scoreForWorkspaceHost(
  client: TServiceClient,
  workspaceId: string,
  host: string,
): Promise<IBadgeScore> {
  const { data: members } = await client
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  const memberIds = (members ?? []).map((m) => m.user_id).filter((id): id is string => id !== null)
  if (memberIds.length === 0) {
    return { score: null, grade: null }
  }
  const { data: rows } = await client
    .from('scans')
    .select('url, report, site_report, smart_report, smart_site_report')
    .in('user_id', memberIds)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(100)

  const wanted = normalizeHost(host)
  for (const row of rows ?? []) {
    if (!isScanReport(row.report)) {
      continue
    }
    if (normalizeHost(hostOf(row.report.finalUrl)) === wanted) {
      const score = combinedScoreFromRow(row)
      return { score, grade: score === null ? null : gradeOf(score) }
    }
  }
  return { score: null, grade: null }
}

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '')
}
