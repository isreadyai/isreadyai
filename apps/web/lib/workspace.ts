import type { TPlan } from '@/lib/plans'
import type { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@isreadyai/supabase'
import { planOrFree } from '@/lib/plans'

// MARK: - Workspace resolution

/** Persists the user's currently-selected workspace across requests/devices. */
export const WORKSPACE_COOKIE = 'isready_active_workspace'

export interface IWorkspaceOption {
  id: string
  name: string
  role: string
  /** 'personal' is the user's signup workspace; everything else is a team. */
  kind: 'personal' | 'team'
  /** The owner's email — the "(email)" shown in the switcher label. */
  email: string
}

type TServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>
type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/** The deterministic slug handle_new_user gives a user's personal workspace. */
function personalSlug(userId: string): string {
  return `u-${userId.replaceAll('-', '')}`
}

/**
 * Resolves the workspace a signed-in user acts in. Every user gets one personal
 * workspace at signup (handle_new_user); they may join others via invites. The
 * selected workspace is held in a cookie and validated here against the user's
 * own active memberships — a tampered cookie can never point at a workspace they
 * don't belong to. Falls back to the earliest membership (their personal one).
 *
 * Reads run on the RLS-scoped session client: the workspace_members SELECT
 * policy lets a member see their own membership rows.
 */
export async function getActiveWorkspaceId(
  supabase: TServerClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
  const memberships = data ?? []
  if (memberships.length === 0) {
    return null
  }
  const requested = (await cookies()).get(WORKSPACE_COOKIE)?.value
  if (requested !== undefined && memberships.some((m) => m.workspace_id === requested)) {
    return requested
  }
  // No explicit choice yet: default INTO a team the user belongs to rather than
  // their personal workspace, falling back to personal when they have no team.
  const { data: personal } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', personalSlug(userId))
    .maybeSingle()
  const personalId = personal?.id ?? null
  const team = memberships.find((m) => m.workspace_id !== personalId)
  return (team ?? memberships[0])?.workspace_id ?? null
}

/** The caller's active role in a workspace, or null if they aren't a member. */
export async function getMemberRole(
  supabase: TServerClient,
  userId: string,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data?.role ?? null
}

/** owner/admin may manage members, billing, api keys and roles. */
export function isWorkspaceManager(role: string | null): boolean {
  return role === 'owner' || role === 'admin'
}

/**
 * owner/admin/member may edit workspace content (track/rename domains, toggle
 * monitoring & badge). viewer and billing are read-only for content.
 */
export function canEditWorkspace(role: string | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'member'
}

/** Kept as the team-facing alias of {@link isWorkspaceManager}. */
export function canManageTeam(role: string | null): boolean {
  return isWorkspaceManager(role)
}

/**
 * The plan that governs a workspace's entitlements — its active owner's plan.
 * For sessionless callers (API keys, public badge, CI uploads) that can't use
 * `resolveWorkspaceContext`. Falls back to free when the owner or plan is absent.
 */
export async function ownerPlanForWorkspace(
  service: TServiceClient,
  workspaceId: string,
): Promise<TPlan> {
  const { data: owner } = await service
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle()
  const ownerId = owner?.user_id ?? null
  if (ownerId === null) {
    return planOrFree(null)
  }
  const { data: profile } = await service
    .from('profiles')
    .select('plan')
    .eq('id', ownerId)
    .maybeSingle()
  return planOrFree(profile?.plan)
}

/**
 * The workspaces the user can switch between (their active memberships), newest
 * pick first. Names come from the service client because the workspaces SELECT
 * policy isn't relied on here and membership is already proven by the join.
 */
export async function listWorkspaceOptions(
  supabase: TServerClient,
  userId: string,
): Promise<IWorkspaceOption[]> {
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
  const rows = memberships ?? []
  if (rows.length === 0) {
    return []
  }
  const ids = rows.map((r) => r.workspace_id)
  const service = await createServiceClient()
  const [{ data: workspaces }, { data: owners }] = await Promise.all([
    service.from('workspaces').select('id, name, slug').in('id', ids),
    service
      .from('workspace_members')
      .select('workspace_id, user_id')
      .in('workspace_id', ids)
      .eq('role', 'owner')
      .eq('status', 'active'),
  ])
  const wsById = new Map((workspaces ?? []).map((w) => [w.id, w]))
  const ownerByWs = new Map((owners ?? []).map((o) => [o.workspace_id, o.user_id]))
  const ownerIds = [...new Set((owners ?? []).map((o) => o.user_id))]
  const { data: profiles } = await service.from('profiles').select('id, email').in('id', ownerIds)
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]))

  const mySlug = personalSlug(userId)
  const options: IWorkspaceOption[] = rows.map((r) => {
    const ws = wsById.get(r.workspace_id)
    const kind: 'personal' | 'team' = ws?.slug === mySlug ? 'personal' : 'team'
    const ownerId = ownerByWs.get(r.workspace_id)
    const email = (ownerId === undefined ? null : emailById.get(ownerId)) ?? ''
    return { id: r.workspace_id, name: ws?.name ?? '—', role: r.role, kind, email }
  })
  // Teams first, personal last — the default lands on a team.
  return options.toSorted((a, b) => (a.kind === b.kind ? 0 : a.kind === 'team' ? -1 : 1))
}
