import type { TPlan } from '@/lib/plans'
import { createServiceClient } from '@isreadyai/supabase'
import { planOrFree } from '@/lib/plans'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveWorkspaceId, getMemberRole } from '@/lib/workspace'

// MARK: - Active workspace context (data scoping)
//
// scans, api_keys and ai_usage are keyed by user_id, while websites and
// notifications are keyed by workspace_id. To show "the workspace's data" for a
// member, we prove the caller belongs to the active workspace, then read the
// other members' user-keyed rows through the service client (RLS hides rows that
// aren't the caller's own). This mirrors the team page's read pattern.

export interface IWorkspaceContext {
  userId: string
  workspaceId: string
  /** The caller's role in the active workspace. */
  role: string
  /** Active member user ids — scopes user-keyed resources (scans, keys, usage). */
  memberIds: string[]
  /** The owner's user id; entitlements/billing derive from the owner's plan. */
  ownerId: string | null
  /** The workspace's effective plan (its owner's), driving displayed limits. */
  ownerPlan: TPlan
}

/**
 * Resolves the caller's active workspace and its membership, or null when the
 * user is signed out or has no workspace. Safe to call from any server component
 * or server action.
 */
export async function resolveWorkspaceContext(): Promise<IWorkspaceContext | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return null
  }
  const workspaceId = await getActiveWorkspaceId(supabase, user.id)
  if (workspaceId === null) {
    return null
  }
  const role = await getMemberRole(supabase, user.id, workspaceId)
  if (role === null) {
    return null
  }

  // Service client: the membership roster of OTHER users isn't readable via RLS,
  // and the caller is already proven to be a member of this workspace above.
  const service = await createServiceClient()
  const { data: members } = await service
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  const roster = members ?? []
  const owner = roster.find((m) => m.role === 'owner')

  const { data: ownerProfile } = owner
    ? await service.from('profiles').select('plan').eq('id', owner.user_id).maybeSingle()
    : { data: null }

  return {
    userId: user.id,
    workspaceId,
    role,
    memberIds: roster.map((m) => m.user_id),
    ownerId: owner?.user_id ?? null,
    ownerPlan: planOrFree(ownerProfile?.plan),
  }
}
