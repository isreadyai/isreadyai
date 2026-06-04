'use server'

import { isScanReport } from '@isreadyai/scanner'
import { isPaidPlan } from '@/lib/plans'
import { fixPlanConfigured, generateAiFixPlan } from '@/lib/fix-plan-ai'
import { resolveWorkspaceContext } from '@/lib/workspace-context'

// MARK: - Generate the premium AI fix plan for a report (in-product)

export type TFixPlanResult =
  | { ok: true; plan: string }
  | { ok: false; error: 'premium_required' | 'unconfigured' | 'failed' }

/**
 * Writes a tailored AI remediation plan for a scan report, gated on the caller's
 * effective (workspace owner's) plan. The report is re-validated here rather
 * than trusted from the client. Mirrors POST /api/fix-plan for the in-product
 * Solution block; the Action uses the API route.
 */
export async function generateReportFixPlan(report: unknown): Promise<TFixPlanResult> {
  if (!isScanReport(report)) {
    return { ok: false, error: 'failed' }
  }
  const ctx = await resolveWorkspaceContext()
  if (ctx === null || !isPaidPlan(ctx.ownerPlan)) {
    return { ok: false, error: 'premium_required' }
  }
  if (!fixPlanConfigured()) {
    return { ok: false, error: 'unconfigured' }
  }
  const plan = await generateAiFixPlan(report)
  return plan === null ? { ok: false, error: 'failed' } : { ok: true, plan }
}
