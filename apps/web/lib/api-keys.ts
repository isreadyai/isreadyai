import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import type { IApiKey, IFixQuota } from '@/lib/api-key-types'
import { EPlan, PLAN_FIX_QUOTA, planOrFree, type TPlan } from '@/lib/plans'
import { ownerPlanForWorkspace } from '@/lib/workspace'

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

// MARK: - API keys + fix-run metering

/**
 * With Supabase, keys and usage live in Postgres. Without it,
 * ISREADYAI_DEV_API_KEY unlocks one in-memory free-plan key for local testing.
 * Raw keys are never stored — only their SHA-256 hex.
 */

const QUOTA_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export async function hashKey(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// MARK: - Memory backend (dev)

const DEV_KEY_ID = 'dev-key'
const memoryRuns: number[] = []

function devKey(): string | undefined {
  const key = process.env.ISREADYAI_DEV_API_KEY
  return key !== undefined && key.length > 0 ? key : undefined
}

// MARK: - Verification

export async function verifyApiKey(raw: string): Promise<IApiKey | null> {
  if (!isSupabaseConfigured()) {
    return devKey() !== undefined && raw === devKey() ? { id: DEV_KEY_ID, plan: EPlan.FREE } : null
  }
  const client = await createServiceClient()
  const { data, error } = await client
    .from('api_keys')
    .select('id, user_id, workspace_id, revoked_at')
    .eq('key_hash', await hashKey(raw))
    .maybeSingle()
  if (error !== null || data === null || data.revoked_at !== null || data.user_id === null) {
    return null
  }
  const plan = await resolveKeyPlan(client, {
    user_id: data.user_id,
    workspace_id: data.workspace_id,
  })
  return plan === null ? null : { id: data.id, plan }
}

export async function findApiKeyById(id: IApiKey['id']): Promise<IApiKey | null> {
  if (!isSupabaseConfigured()) {
    return id === DEV_KEY_ID && devKey() !== undefined ? { id, plan: EPlan.FREE } : null
  }
  const client = await createServiceClient()
  const { data, error } = await client
    .from('api_keys')
    .select('id, user_id, workspace_id, revoked_at')
    .eq('id', id)
    .maybeSingle()
  if (error !== null || data === null || data.revoked_at !== null || data.user_id === null) {
    return null
  }
  const plan = await resolveKeyPlan(client, {
    user_id: data.user_id,
    workspace_id: data.workspace_id,
  })
  return plan === null ? null : { id: data.id, plan }
}

/**
 * A key's effective plan follows the WORKSPACE OWNER's plan (resolved from the
 * key's workspace_id), so a paid team's keys — even when minted by a non-owner
 * manager — get the team's entitlements. Legacy keys without a workspace fall
 * back to the creator's own plan, failing closed when that profile is gone.
 */
async function resolveKeyPlan(
  client: TServiceClient,
  row: { user_id: string; workspace_id: string | null },
): Promise<TPlan | null> {
  if (row.workspace_id !== null) {
    return ownerPlanForWorkspace(client, row.workspace_id)
  }
  const { data: profile } = await client
    .from('profiles')
    .select('plan')
    .eq('id', row.user_id)
    .maybeSingle()
  return profile === null ? null : planOrFree(profile.plan)
}

/** The auth.users id that owns a key — needed to scope repo/website ownership. */
export async function apiKeyOwnerId(key: IApiKey): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  const client = await createServiceClient()
  const { data } = await client.from('api_keys').select('user_id').eq('id', key.id).maybeSingle()
  return data?.user_id ?? null
}

// MARK: - Quota

/**
 * Funded-AI quota: fix, fix-plan and solve runs share ONE per-period bucket
 * (PLAN_FIX_QUOTA[plan] total across all kinds), so a key can't get 3× the
 * intended ceiling by spreading spend across endpoints. Fails CLOSED on a read
 * error (reports the limit as fully consumed) so a metering blip can't unlock
 * unbounded funded-AI spend; free keys (limit 0) stay blocked regardless.
 *
 * NOTE: the gate is still check-then-record at the call site, so tightly
 * concurrent requests from one key near the limit can overshoot by a few. A
 * DB-side atomic counter is the proper fix (follow-up).
 */
async function meteredQuota(key: IApiKey): Promise<IFixQuota> {
  const limit = PLAN_FIX_QUOTA[key.plan]
  if (!isSupabaseConfigured()) {
    const since = Date.now() - QUOTA_WINDOW_MS
    return { used: memoryRuns.filter((t) => t > since).length, limit }
  }
  const client = await createServiceClient()
  const since = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString()
  const { count, error } = await client
    .from('fix_runs')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', key.id)
    .gte('created_at', since)
  if (error !== null || count === null) {
    return { used: limit, limit }
  }
  return { used: count, limit }
}

/** Fix-PR runs — metered against the single shared funded-AI bucket. */
export async function fixQuota(key: IApiKey): Promise<IFixQuota> {
  return meteredQuota(key)
}

/** Premium AI solve runs — share the single funded-AI bucket (see meteredQuota). */
export async function solveQuota(key: IApiKey): Promise<IFixQuota> {
  return meteredQuota(key)
}

/** AI fix-plan runs (POST /api/fix-plan) — share the single funded-AI bucket. */
export async function planQuota(key: IApiKey): Promise<IFixQuota> {
  return meteredQuota(key)
}

/**
 * Atomically reserve ONE funded-AI run against the shared per-period bucket:
 * counts the key's runs in the window and inserts the new run only if under the
 * plan limit, in a single advisory-locked transaction (the consume_metered_run
 * DB function). Replaces the racy check-then-record so concurrent requests from
 * one key can't overshoot the quota. Returns the new run id, or null when the
 * quota is exhausted or on a metering error (fail closed). Callers refund via
 * {@link refundMeteredRun} when the downstream work then fails.
 */
export async function consumeMeteredRun(
  key: IApiKey,
  run: { kind: 'fix' | 'plan' | 'solve'; repo: string; url: string; patches: number },
): Promise<string | null> {
  const limit = PLAN_FIX_QUOTA[key.plan]
  if (limit <= 0) {
    return null // free plan: no funded runs
  }
  if (!isSupabaseConfigured()) {
    const since = Date.now() - QUOTA_WINDOW_MS
    if (memoryRuns.filter((t) => t > since).length >= limit) {
      return null
    }
    memoryRuns.push(Date.now())
    return crypto.randomUUID()
  }
  const client = await createServiceClient()
  const { data, error } = await client.rpc('consume_metered_run', {
    p_api_key_id: key.id,
    p_kind: run.kind,
    p_repo: run.repo,
    p_url: run.url,
    p_patches: run.patches,
    p_window_ms: QUOTA_WINDOW_MS,
    p_limit: limit,
  })
  // Fail closed: a metering error must not unlock a funded run; null = over limit.
  if (error !== null || data === null) {
    return null
  }
  return data
}

/** Backfills the patch count on a reserved run once the work knows it (fix only). */
export async function setMeteredRunPatches(runId: string, patches: number): Promise<void> {
  if (!isSupabaseConfigured()) {
    return
  }
  const client = await createServiceClient()
  await client.from('fix_runs').update({ patches }).eq('id', runId)
}

/** Refunds a reserved run when the downstream work fails (deletes the row). */
export async function refundMeteredRun(runId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryRuns.pop()
    return
  }
  const client = await createServiceClient()
  await client.from('fix_runs').delete().eq('id', runId)
}
