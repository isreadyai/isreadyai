'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@isreadyai/supabase'
import type { TActionResult } from '@/lib/action-result'
import { hashKey } from '@/lib/api-keys'
import type { IApiKey } from '@/lib/api-key-types'
import { planOrFree } from '@/lib/plans'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getActiveWorkspaceId,
  getMemberRole,
  isWorkspaceManager,
  ownerPlanForWorkspace,
} from '@/lib/workspace'

// MARK: - API key server actions

/**
 * Keys are workspace-shared and manager-managed: any owner/admin of the key's
 * workspace may mint, rotate, revoke or rename ANY key in it (so a leaked or an
 * ex-teammate's key can be killed) — not just keys they personally created. The
 * key's effective plan follows the workspace owner's plan. Raw keys are returned
 * once and never persisted.
 */

const KEY_PREFIX = 'isr_'
// Stored alongside the hash so the UI can show a masked identifier (never the key).
const PREFIX_LENGTH = 12

export type TCreateApiKeyResult = TActionResult<{ rawKey: string }>
export type TRevokeApiKeyResult = TActionResult

function mintKey(): { rawKey: string; prefix: string } {
  const rawKey = `${KEY_PREFIX}${crypto.randomUUID().replaceAll('-', '')}`
  return { rawKey, prefix: rawKey.slice(0, PREFIX_LENGTH) }
}

export async function createApiKey(label: string): Promise<TCreateApiKeyResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }

  const { data: profile } = await session
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (profile === null) {
    return { ok: false, error: 'no_profile' }
  }

  // API keys belong to a workspace; only its owners/admins may mint them.
  const workspaceId = await getActiveWorkspaceId(session, user.id)
  if (workspaceId === null) {
    return { ok: false, error: 'no_workspace' }
  }
  if (!isWorkspaceManager(await getMemberRole(session, user.id, workspaceId))) {
    return { ok: false, error: 'role_required' }
  }

  const trimmed = label.trim()
  const { rawKey, prefix } = mintKey()

  // The snapshot plan follows the workspace owner, not the minting admin's plan.
  const service = await createServiceClient()
  const ownerPlan = await ownerPlanForWorkspace(service, workspaceId)
  const { error } = await service.from('api_keys').insert({
    user_id: user.id,
    created_by: user.id,
    workspace_id: workspaceId,
    plan: ownerPlan,
    key_hash: await hashKey(rawKey),
    prefix,
    label: trimmed.length > 0 ? trimmed : null,
  })
  if (error !== null) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/api-keys')
  return { ok: true, rawKey }
}

export async function renameApiKey(id: IApiKey['id'], label: string): Promise<TActionResult> {
  const auth = await manageableKey(id)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  const trimmed = label.trim()
  const { error } = await auth.service
    .from('api_keys')
    .update({ label: trimmed.length > 0 ? trimmed : null })
    .eq('id', id)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard/api-keys')
  return { ok: true }
}

/** Revokes the key and issues a fresh one with the same label/plan; the new raw key is shown once. */
export async function rotateApiKey(id: IApiKey['id']): Promise<TCreateApiKeyResult> {
  const auth = await manageableKey(id)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  const { service, callerId, key } = auth
  if (key.revoked_at !== null) {
    return { ok: false, error: 'not_found' }
  }

  const { rawKey, prefix } = mintKey()
  // Re-resolve the plan from the workspace owner so a rotated key tracks the team.
  const plan =
    key.workspace_id !== null
      ? await ownerPlanForWorkspace(service, key.workspace_id)
      : planOrFree(key.plan)
  const { error: insertError } = await service.from('api_keys').insert({
    user_id: key.user_id ?? callerId,
    created_by: callerId,
    workspace_id: key.workspace_id,
    plan,
    key_hash: await hashKey(rawKey),
    prefix,
    label: key.label,
  })
  if (insertError !== null) {
    return { ok: false, error: insertError.message }
  }
  await service.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)

  revalidatePath('/dashboard/api-keys')
  return { ok: true, rawKey }
}

export async function revokeApiKey(id: IApiKey['id']): Promise<TRevokeApiKeyResult> {
  const auth = await manageableKey(id)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }
  const { error } = await auth.service
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error !== null) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/api-keys')
  return { ok: true }
}

// MARK: - internal

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

interface IManageableKey {
  service: TServiceClient
  callerId: string
  key: {
    id: string
    label: string | null
    plan: string | null
    workspace_id: string | null
    user_id: string | null
    revoked_at: string | null
  }
}

/**
 * Authorizes a mutation on a workspace-shared API key: a manager (owner/admin) of
 * the key's workspace may act on ANY key in it; legacy keys without a workspace
 * fall back to creator-only. Returns 'not_found' for unauthorized callers so key
 * existence never leaks.
 */
async function manageableKey(
  id: string,
): Promise<
  ({ ok: true } & IManageableKey) | { ok: false; error: 'unauthenticated' | 'not_found' }
> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  const service = await createServiceClient()
  const { data: key } = await service
    .from('api_keys')
    .select('id, label, plan, workspace_id, user_id, revoked_at')
    .eq('id', id)
    .maybeSingle()
  if (key === null) {
    return { ok: false, error: 'not_found' }
  }
  const authorized =
    key.workspace_id !== null
      ? isWorkspaceManager(await getMemberRole(session, user.id, key.workspace_id))
      : key.user_id === user.id
  if (!authorized) {
    return { ok: false, error: 'not_found' }
  }
  return { ok: true, service, callerId: user.id, key }
}
