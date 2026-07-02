'use server'

import { isScanReport } from '@isreadyai/scanner'
import { createServiceClient } from '@isreadyai/supabase'
import { isPaidPlan } from '@/lib/plans'
import { fixPlanConfigured, generateAiFixPlan } from '@/lib/fix-plan-ai'
import { hostOf, normalizeHost } from '@/lib/url'
import { resolveWorkspaceContext } from '@/lib/workspace-context'

// MARK: - Generate the premium AI fix plan for a report (in-product)

// Bound the ownership lookup to the workspace's recent completed scans (mirrors
// badge-score's workspace-host match).
const OWNERSHIP_SCAN_LOOKBACK = 100

export type TFixPlanResult =
  | { ok: true; plan: string }
  | { ok: false; error: 'premium_required' | 'not_owned' | 'unconfigured' | 'failed' }

/**
 * Writes a tailored AI remediation plan for a scan report, gated on the caller's
 * effective (workspace owner's) plan AND on workspace ownership of the report's
 * host. The report is sent by value, so it is re-validated and re-authorized here
 * rather than trusted from the client. Mirrors POST /api/fix-plan for the
 * in-product Solution block; the Action uses the API route.
 */
export async function generateReportFixPlan(report: unknown): Promise<TFixPlanResult> {
  if (!isScanReport(report)) {
    return { ok: false, error: 'failed' }
  }
  const ctx = await resolveWorkspaceContext()
  if (ctx === null || !isPaidPlan(ctx.ownerPlan)) {
    return { ok: false, error: 'premium_required' }
  }
  // Ownership: a by-value report is attacker-controlled, so re-prove the caller's
  // workspace actually scanned this host before spending funded inference on it.
  if (!(await workspaceOwnsHost(ctx.memberIds, hostOf(report.finalUrl)))) {
    return { ok: false, error: 'not_owned' }
  }
  if (!fixPlanConfigured()) {
    return { ok: false, error: 'unconfigured' }
  }
  const plan = await generateAiFixPlan(report)
  return plan === null ? { ok: false, error: 'failed' } : { ok: true, plan }
}

/**
 * True when the workspace's members have a completed scan of `host`. Scans are
 * user-keyed, so membership scopes the lookup; fails closed (false) on any miss.
 */
async function workspaceOwnsHost(memberIds: string[], host: string): Promise<boolean> {
  if (memberIds.length === 0) {
    return false
  }
  const service = await createServiceClient()
  const { data: rows } = await service
    .from('scans')
    .select('report')
    .in('user_id', memberIds)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(OWNERSHIP_SCAN_LOOKBACK)
  const wanted = normalizeHost(host)
  return (rows ?? []).some(
    (row) => isScanReport(row.report) && normalizeHost(hostOf(row.report.finalUrl)) === wanted,
  )
}
