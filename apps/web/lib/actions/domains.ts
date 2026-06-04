'use server'

import { resolveTxt } from 'node:dns/promises'
import { randomUUID } from 'node:crypto'
import { validateScanInput } from '@isreadyai/scanner'
import { createServiceClient } from '@isreadyai/supabase'
import { revalidatePath } from 'next/cache'
import type { TActionResult } from '@/lib/action-result'
import { checkQuota, resolveEntitlements } from '@/lib/entitlements'
import type { TPlan } from '@/lib/plans'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  canEditWorkspace,
  getActiveWorkspaceId,
  getMemberRole,
  isWorkspaceManager,
  ownerPlanForWorkspace,
} from '@/lib/workspace'

// MARK: - Tracked-domain server actions ("My websites")
//
// Domains are workspace-scoped (the `websites` table). Entitlements (how many
// sites, monitoring, badge) follow the WORKSPACE OWNER's plan — never the acting
// member's personal plan — and every mutation enforces a role floor server-side:
// owner/admin/member may edit, viewer/billing are read-only, deleting a site is
// manager-only. RLS reads run on the session client; writes on the service client
// only AFTER the role check.

export interface ITrackedDomain {
  id: string
  host: string
  status: string
  badgeEnabled: boolean
  monitoringEnabled: boolean
  verifiedAt: string | null
}

export type TAddDomainResult = TActionResult<{ id: string }>

export async function addTrackedDomain(host: string): Promise<TAddDomainResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }

  const validated = validateScanInput(host)
  if (!validated.ok) {
    return { ok: false, error: 'invalid_domain' }
  }
  const normalizedHost = new URL(validated.url).host

  const workspaceId = await getActiveWorkspaceId(session, user.id)
  if (workspaceId === null) {
    return { ok: false, error: 'no_workspace' }
  }
  const role = await getMemberRole(session, user.id, workspaceId)
  if (!canEditWorkspace(role)) {
    return { ok: false, error: 'role_required' }
  }

  // Quota is the workspace owner's plan limit measured against the workspace-wide
  // site count (both scoped to workspace_id) — not the acting member's own plan.
  const service = await createServiceClient()
  const ownerPlan = await ownerPlanForWorkspace(service, workspaceId)
  const { count } = await session
    .from('websites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  const quota = checkQuota(ownerPlan, 'maxDomains', count ?? 0)
  if (!quota.allowed) {
    return { ok: false, error: 'upgrade_required' }
  }

  const { data, error } = await service
    .from('websites')
    .insert({
      workspace_id: workspaceId,
      host: normalizedHost,
      created_by: user.id,
      // Mint the DNS-TXT challenge ONCE, at creation, so it stays stable across
      // verify attempts (re-randomizing it would invalidate an already-published record).
      verification_method: 'dns-txt',
      verification_token: randomUUID().replace(/-/g, ''),
    })
    .select('id')
    .maybeSingle()
  if (error !== null) {
    // unique(workspace_id, host) → the site is already tracked in this workspace.
    return { ok: false, error: 'already_tracked' }
  }

  revalidatePath('/dashboard/websites')
  return { ok: true, id: data?.id ?? '' }
}

export async function removeTrackedDomain(domainId: string): Promise<TActionResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  // Deleting a tracked site is destructive — managers (owner/admin) only.
  if (!isWorkspaceManager(auth.role)) {
    return { ok: false, error: 'role_required' }
  }

  const { error } = await auth.service.from('websites').delete().eq('id', domainId)
  if (error !== null) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/websites')
  return { ok: true }
}

// MARK: - DNS-TXT ownership verification

const TXT_PREFIX = 'isready-verify='

export type TVerifyRequestResult = TActionResult<{ recordName: string; recordValue: string }>

/** Issues a DNS-TXT challenge: the owner publishes the returned record, then calls verifyDomain. */
export async function requestDomainVerification(domainId: string): Promise<TVerifyRequestResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  // Reuse the token minted at creation; only mint one for legacy rows that lack it.
  const token = auth.website.verification_token ?? randomUUID().replace(/-/g, '')
  const { error } = await auth.service
    .from('websites')
    .update({ verification_method: 'dns-txt', verification_token: token, status: 'pending' })
    .eq('id', domainId)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard/websites')
  return {
    ok: true,
    recordName: `_isready.${auth.website.host}`,
    recordValue: `${TXT_PREFIX}${token}`,
  }
}

/** Resolves the challenge TXT record and marks the domain verified on a match. */
export async function verifyDomain(domainId: string): Promise<TActionResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  if (auth.website.verification_token === null) {
    return { ok: false, error: 'not_found' }
  }
  let records: string[][]
  try {
    records = await resolveTxt(`_isready.${auth.website.host}`)
  } catch {
    return { ok: false, error: 'dns_lookup_failed' }
  }
  const expected = `${TXT_PREFIX}${auth.website.verification_token}`
  const matched = records.some((chunks) => chunks.join('').trim() === expected)
  if (!matched) {
    return { ok: false, error: 'record_not_found' }
  }
  const { error } = await auth.service
    .from('websites')
    .update({ status: 'verified', verified_at: new Date().toISOString() })
    .eq('id', domainId)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard/websites')
  return { ok: true }
}

// MARK: - Monitoring (premium)

/** Enables/disables scheduled re-scans for a verified domain. Premium-gated. */
export async function setMonitoring(domainId: string, enabled: boolean): Promise<TActionResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  const entitlements = resolveEntitlements(auth.ownerPlan)
  if (enabled && !entitlements.monitoringEnabled) {
    return { ok: false, error: 'upgrade_required' }
  }
  if (enabled && auth.website.status !== 'verified') {
    return { ok: false, error: 'verification_required' }
  }

  const service = auth.service
  const { error: monitoringError } = await service
    .from('websites')
    .update({ monitoring_enabled: enabled })
    .eq('id', domainId)
  if (monitoringError !== null) {
    return { ok: false, error: 'failed' }
  }

  const { data: existing } = await service
    .from('monitoring_schedules')
    .select('id')
    .eq('website_id', domainId)
    .maybeSingle()
  if (enabled) {
    const frequency =
      entitlements.monitoringFrequency === 'none' ? 'weekly' : entitlements.monitoringFrequency
    const patch = {
      frequency,
      paused_at: null,
      next_run_at: new Date().toISOString(),
      created_by: auth.userId,
    }
    if (existing === null) {
      const { error: scheduleError } = await service
        .from('monitoring_schedules')
        .insert({ website_id: domainId, ...patch })
      if (scheduleError !== null) {
        return { ok: false, error: 'failed' }
      }
    } else {
      const { error: scheduleError } = await service
        .from('monitoring_schedules')
        .update(patch)
        .eq('id', existing.id)
      if (scheduleError !== null) {
        return { ok: false, error: 'failed' }
      }
    }
  } else if (existing !== null) {
    const { error: scheduleError } = await service
      .from('monitoring_schedules')
      .update({ paused_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (scheduleError !== null) {
      return { ok: false, error: 'failed' }
    }
  }

  revalidatePath('/dashboard/websites')
  return { ok: true }
}

export type TScanMode = 'simple' | 'deep'

/** Sets whether monitoring re-scans run a simple page scan or the deep crawl. */
export async function setMonitoringScanMode(
  domainId: string,
  mode: TScanMode,
): Promise<TActionResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  if (!resolveEntitlements(auth.ownerPlan).monitoringEnabled) {
    return { ok: false, error: 'upgrade_required' }
  }
  const { data: existing } = await auth.service
    .from('monitoring_schedules')
    .select('id')
    .eq('website_id', domainId)
    .maybeSingle()
  if (existing === null) {
    return { ok: false, error: 'monitoring_required' }
  }
  const { error } = await auth.service
    .from('monitoring_schedules')
    .update({ scan_mode: mode })
    .eq('id', existing.id)
  if (error !== null) {
    return { ok: false, error: 'failed' }
  }
  revalidatePath('/dashboard/websites')
  return { ok: true }
}

/** Toggles whether scans for this domain run the Smart Agent readability pass. */
export async function setMonitoringSmartAgent(
  domainId: string,
  enabled: boolean,
): Promise<TActionResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  if (!resolveEntitlements(auth.ownerPlan).monitoringEnabled) {
    return { ok: false, error: 'upgrade_required' }
  }
  const { data: existing } = await auth.service
    .from('monitoring_schedules')
    .select('id')
    .eq('website_id', domainId)
    .maybeSingle()
  if (existing === null) {
    return { ok: false, error: 'monitoring_required' }
  }
  const { error } = await auth.service
    .from('monitoring_schedules')
    .update({ smart_agent_enabled: enabled })
    .eq('id', existing.id)
  if (error !== null) {
    return { ok: false, error: 'failed' }
  }
  revalidatePath('/dashboard/websites')
  return { ok: true }
}

/**
 * Sets the per-domain score-drop alert sensitivity (the cron alerts when a scan
 * falls this many points vs the previous one). 1–50 points. Premium-gated.
 */
export async function setMonitoringAlertDelta(
  domainId: string,
  delta: number,
): Promise<TActionResult> {
  if (!Number.isInteger(delta) || delta < 1 || delta > 50) {
    return { ok: false, error: 'invalid_input' }
  }
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  if (!resolveEntitlements(auth.ownerPlan).monitoringEnabled) {
    return { ok: false, error: 'upgrade_required' }
  }
  const { data: existing } = await auth.service
    .from('monitoring_schedules')
    .select('id')
    .eq('website_id', domainId)
    .maybeSingle()
  if (existing === null) {
    return { ok: false, error: 'monitoring_required' }
  }
  const { error } = await auth.service
    .from('monitoring_schedules')
    .update({ alert_delta: delta })
    .eq('id', existing.id)
  if (error !== null) {
    return { ok: false, error: 'failed' }
  }
  revalidatePath('/dashboard/websites')
  return { ok: true }
}

/**
 * Sets (or clears) the per-domain absolute alert threshold: the cron alerts when
 * a monitored scan falls below it. Pass null to disable it (relative-drop alerts
 * still apply). 0–100 points. Premium-gated.
 */
export async function setMonitoringAlertThreshold(
  domainId: string,
  threshold: number | null,
): Promise<TActionResult> {
  if (threshold !== null && (!Number.isInteger(threshold) || threshold < 0 || threshold > 100)) {
    return { ok: false, error: 'invalid_input' }
  }
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  if (!resolveEntitlements(auth.ownerPlan).monitoringEnabled) {
    return { ok: false, error: 'upgrade_required' }
  }
  const { data: existing } = await auth.service
    .from('monitoring_schedules')
    .select('id')
    .eq('website_id', domainId)
    .maybeSingle()
  if (existing === null) {
    return { ok: false, error: 'monitoring_required' }
  }
  const { error } = await auth.service
    .from('monitoring_schedules')
    .update({ alert_threshold: threshold })
    .eq('id', existing.id)
  if (error !== null) {
    return { ok: false, error: 'failed' }
  }
  revalidatePath('/dashboard/websites')
  return { ok: true }
}

/** Activates/deactivates the public README badge for a domain. Pro/Team only. */
export async function setBadgeEnabled(domainId: string, enabled: boolean): Promise<TActionResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  if (!resolveEntitlements(auth.ownerPlan).badge) {
    return { ok: false, error: 'upgrade_required' }
  }
  if (enabled && auth.website.verified_at === null) {
    return { ok: false, error: 'verification_required' }
  }
  const { error } = await auth.service
    .from('websites')
    .update({ badge_enabled: enabled })
    .eq('id', domainId)
  if (error !== null) {
    return { ok: false, error: 'failed' }
  }
  revalidatePath('/dashboard/websites')
  return { ok: true }
}

/** Sets an optional friendly display label for a tracked website (host unchanged). */
export async function renameWebsite(domainId: string, name: string): Promise<TActionResult> {
  const auth = await domainAuth(domainId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  if (!canEditWorkspace(auth.role)) {
    return { ok: false, error: 'role_required' }
  }
  const trimmed = name.trim().slice(0, 80)
  const label = trimmed.length > 0 && trimmed !== auth.website.host ? trimmed : null
  const { error } = await auth.service.from('websites').update({ name: label }).eq('id', domainId)
  if (error !== null) {
    return { ok: false, error: 'failed' }
  }
  revalidatePath('/dashboard/websites')
  revalidatePath(`/dashboard/websites/${domainId}`)
  return { ok: true }
}

// MARK: - internal

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

interface IDomainAuth {
  service: TServiceClient
  userId: string
  workspaceId: string
  role: string
  ownerPlan: TPlan
  website: {
    id: string
    host: string
    status: string
    verified_at: string | null
    verification_token: string | null
    workspace_id: string
  }
}

type TDomainAuth =
  | ({ ok: true } & IDomainAuth)
  | { ok: false; error: 'unauthenticated' | 'not_found' }

/**
 * Authorizes a mutation on a workspace-owned website. The RLS read returns the
 * row only to active members (membership proof); we then resolve the caller's
 * role and the workspace owner's plan (the entitlement source). Callers enforce
 * their own role floor (edit vs manager) on the returned `role`.
 */
async function domainAuth(domainId: string): Promise<TDomainAuth> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  const { data: website } = await session
    .from('websites')
    .select('id, host, status, verified_at, verification_token, workspace_id')
    .eq('id', domainId)
    .maybeSingle()
  if (website === null) {
    return { ok: false, error: 'not_found' }
  }
  const role = await getMemberRole(session, user.id, website.workspace_id)
  if (role === null) {
    return { ok: false, error: 'not_found' }
  }
  const service = await createServiceClient()
  const ownerPlan = await ownerPlanForWorkspace(service, website.workspace_id)
  return {
    ok: true,
    service,
    userId: user.id,
    workspaceId: website.workspace_id,
    role,
    ownerPlan,
    website,
  }
}
