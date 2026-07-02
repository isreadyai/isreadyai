'use server'

import { createHash, randomBytes } from 'node:crypto'
import { createServiceClient } from '@isreadyai/supabase'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import type { TActionResult } from '@/lib/action-result'
import { syncSeatQuantity } from '@/lib/billing-seats'
import { sendInviteEmail } from '@/lib/email-invite'
import { resolveEntitlements } from '@/lib/entitlements'
import { isPaidPlan, planOrFree } from '@/lib/plans'
import { SITE_URL } from '@/lib/site'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  canManageTeam,
  getActiveWorkspaceId,
  getMemberRole,
  ownerPlanForWorkspace,
  WORKSPACE_COOKIE,
} from '@/lib/workspace'

// MARK: - Team server actions (members, invitations, roles)
//
// Security: every mutation re-derives the caller's role server-side (never
// trusted from the client) and runs through the service client only AFTER the
// role check. Invite tokens are stored as SHA-256 hashes (the raw token only
// ever travels in the invite link). The last active owner can't be demoted or
// removed.

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
// 'owner' is intentionally absent: ownership is only ever handed off through the
// owner-only transferOwnership path, never assigned via invite or role change.
const INVITABLE_ROLES = ['admin', 'member', 'viewer', 'billing'] as const

const InviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(INVITABLE_ROLES),
})

interface ITeamContext {
  userId: string
  workspaceId: string
  role: string
}

/** Resolves the caller's workspace + role, or null when unauthenticated/none. */
async function teamContext(): Promise<ITeamContext | null> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return null
  }
  const workspaceId = await getActiveWorkspaceId(session, user.id)
  if (workspaceId === null) {
    return null
  }
  const role = await getMemberRole(session, user.id, workspaceId)
  if (role === null) {
    return null
  }
  return { userId: user.id, workspaceId, role }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

// MARK: - Invite

export type TInviteResult = TActionResult<{ inviteUrl: string }>

export async function inviteMember(email: string, role: string): Promise<TInviteResult> {
  const ctx = await teamContext()
  if (ctx === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  if (!canManageTeam(ctx.role)) {
    return { ok: false, error: 'role_required' }
  }
  const parsed = InviteSchema.safeParse({ email, role })
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' }
  }
  const normalizedEmail = parsed.data.email.trim().toLowerCase()

  const service = await createServiceClient()

  // Seat limit follows the WORKSPACE OWNER's plan (the team's entitlement source),
  // not the inviting admin's personal plan — and NOT workspaces.seat_limit, which
  // is only seeded at signup and never re-synced. Active members + pending invites
  // must stay within it.
  const ownerPlan = await ownerPlanForWorkspace(service, ctx.workspaceId)
  const seatLimit = resolveEntitlements(ownerPlan).maxMembers
  const used = await seatsUsed(service, ctx.workspaceId)
  if (used >= seatLimit) {
    return { ok: false, error: 'seat_limit' }
  }

  const rawToken = randomBytes(24).toString('hex')
  const { error } = await service.from('workspace_invitations').insert({
    workspace_id: ctx.workspaceId,
    email: normalizedEmail,
    role: parsed.data.role,
    token_hash: hashToken(rawToken),
    invited_by: ctx.userId,
    expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  })
  if (error !== null) {
    return { ok: false, error: error.message }
  }

  await audit(service, ctx, 'member.invited', 'invitation', null, {
    email: normalizedEmail,
    role: parsed.data.role,
  })
  revalidatePath('/dashboard/team')

  // Best-effort delivery — the returned link still works if email is unconfigured.
  const inviteUrl = `${SITE_URL}/invite/${rawToken}`
  await sendInviteEmail(normalizedEmail, inviteUrl).catch(() => false)
  return { ok: true, inviteUrl }
}

export async function revokeInvitation(invitationId: string): Promise<TActionResult> {
  const ctx = await teamContext()
  if (ctx === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  if (!canManageTeam(ctx.role)) {
    return { ok: false, error: 'role_required' }
  }
  const service = await createServiceClient()
  const { error } = await service
    .from('workspace_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('workspace_id', ctx.workspaceId)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard/team')
  return { ok: true }
}

// MARK: - Roles & removal

export async function changeMemberRole(memberId: string, role: string): Promise<TActionResult> {
  const ctx = await teamContext()
  if (ctx === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  if (!canManageTeam(ctx.role)) {
    return { ok: false, error: 'role_required' }
  }
  // 'owner' is not assignable here — promoting to owner is the exclusive job of
  // transferOwnership, so an admin can never mint a co-owner (or self-promote).
  if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
    return { ok: false, error: 'invalid_input' }
  }

  const service = await createServiceClient()
  const { data: member } = await service
    .from('workspace_members')
    .select('role')
    .eq('id', memberId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()
  if (member === null) {
    return { ok: false, error: 'not_found' }
  }
  // Only an owner may change another owner's role — an admin must not be able to
  // demote the owner. With 'owner' unassignable above, this keeps every ownership
  // change inside transferOwnership.
  if (member.role === 'owner' && ctx.role !== 'owner') {
    return { ok: false, error: 'role_required' }
  }
  // Demoting the final owner would orphan the workspace.
  if (member.role === 'owner' && (await ownerCount(service, ctx.workspaceId)) <= 1) {
    return { ok: false, error: 'last_owner' }
  }

  const { error } = await service
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId)
    .eq('workspace_id', ctx.workspaceId)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  await audit(service, ctx, 'member.role_changed', 'member', memberId, { role })
  revalidatePath('/dashboard/team')
  return { ok: true }
}

export async function removeMember(memberId: string): Promise<TActionResult> {
  const ctx = await teamContext()
  if (ctx === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  if (!canManageTeam(ctx.role)) {
    return { ok: false, error: 'role_required' }
  }
  const service = await createServiceClient()
  const { data: member } = await service
    .from('workspace_members')
    .select('role')
    .eq('id', memberId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()
  if (member === null) {
    return { ok: false, error: 'not_found' }
  }
  // Removing an owner is an ownership-level action — only another owner may do it,
  // so an admin can't evict the owner and seize the workspace.
  if (member.role === 'owner' && ctx.role !== 'owner') {
    return { ok: false, error: 'role_required' }
  }
  if (member.role === 'owner' && (await ownerCount(service, ctx.workspaceId)) <= 1) {
    return { ok: false, error: 'last_owner' }
  }

  const { error } = await service
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', ctx.workspaceId)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  await audit(service, ctx, 'member.removed', 'member', memberId, null)
  await syncSeatQuantity(ctx.workspaceId).catch(() => undefined)
  revalidatePath('/dashboard/team')
  return { ok: true }
}

// MARK: - Ownership transfer

/**
 * Hands ownership to another active member. Only the current owner may call it.
 * Promotes the target to `owner` FIRST, then demotes the caller to `admin`, so
 * the "≥1 owner" invariant is never violated even if the second update fails.
 */
export async function transferOwnership(targetMemberId: string): Promise<TActionResult> {
  const ctx = await teamContext()
  if (ctx === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  if (ctx.role !== 'owner') {
    return { ok: false, error: 'role_required' }
  }

  const service = await createServiceClient()

  const { data: target } = await service
    .from('workspace_members')
    .select('id, user_id, role, status')
    .eq('id', targetMemberId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()
  if (target === null || target.status !== 'active') {
    return { ok: false, error: 'not_found' }
  }
  if (target.user_id === ctx.userId || target.role === 'owner') {
    return { ok: false, error: 'invalid_input' }
  }

  // The new owner becomes the team's entitlement + billing source. Without an
  // active paid subscription of their own, the transfer would silently drop the
  // whole workspace to free while the old owner keeps paying — block it.
  const { data: targetProfile } = await service
    .from('profiles')
    .select('plan, subscription_status')
    .eq('id', target.user_id)
    .maybeSingle()
  if (!hasActivePaidSubscription(targetProfile)) {
    return { ok: false, error: 'recipient_not_paid' }
  }

  const { error: promoteError } = await service
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('id', targetMemberId)
    .eq('workspace_id', ctx.workspaceId)
  if (promoteError !== null) {
    return { ok: false, error: promoteError.message }
  }

  const { error: demoteError } = await service
    .from('workspace_members')
    .update({ role: 'admin' })
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', ctx.userId)
  if (demoteError !== null) {
    return { ok: false, error: demoteError.message }
  }

  await audit(service, ctx, 'member.ownership_transferred', 'member', targetMemberId, {
    to: targetMemberId,
  })
  revalidatePath('/dashboard/team')
  return { ok: true }
}

// MARK: - Leave workspace

/**
 * Removes the caller's OWN membership. The last owner can't leave (must transfer
 * first), and a sole member can't leave their personal workspace — both checks
 * run server-side off the service client.
 */
export async function leaveWorkspace(): Promise<TActionResult> {
  const ctx = await teamContext()
  if (ctx === null) {
    return { ok: false, error: 'unauthenticated' }
  }

  const service = await createServiceClient()

  const { count: memberCount } = await service
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
  // Sole member ⇒ this is their personal/default workspace; nobody to hand off to.
  if ((memberCount ?? 0) <= 1) {
    return { ok: false, error: 'cannot_leave_personal' }
  }
  if (ctx.role === 'owner' && (await ownerCount(service, ctx.workspaceId)) <= 1) {
    return { ok: false, error: 'last_owner' }
  }

  const { error } = await service
    .from('workspace_members')
    .delete()
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', ctx.userId)
  if (error !== null) {
    return { ok: false, error: error.message }
  }

  await audit(service, ctx, 'member.left', 'member', null, null)
  await syncSeatQuantity(ctx.workspaceId).catch(() => undefined)
  revalidatePath('/dashboard/team')
  return { ok: true }
}

// MARK: - Accept invitation

/** A pending invite row, already verified to match the caller's email. */
interface IPendingInvite {
  id: string
  workspace_id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
}

/** True while the invite is still actionable (not accepted, revoked or expired). */
function invitePending(invite: IPendingInvite): boolean {
  return (
    invite.accepted_at === null &&
    invite.revoked_at === null &&
    Date.parse(invite.expires_at) >= Date.now()
  )
}

function emailsMatch(a: string | null | undefined, b: string): boolean {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Creates the membership, marks the invite accepted and re-syncs billed seats.
 * Shared by both accept paths (token link and in-app id). The caller MUST have
 * already verified the invite is pending and bound to this user's email.
 *
 * Re-accepting when a membership already exists (duplicate unique key) is treated
 * as success — the invite is still marked accepted — so a double-click or a stale
 * tab doesn't surface a spurious error.
 */
async function finalizeInvitationAcceptance(
  service: TServiceClient,
  invite: IPendingInvite,
  userId: string,
): Promise<TActionResult> {
  // Re-check seats at accept time, not just when the invite was sent: the owner
  // may have downgraded to a smaller plan since. A re-accepting existing member
  // consumes no new seat, so skip the check for them (keeps re-accept idempotent).
  if (!(await isActiveMember(service, invite.workspace_id, userId))) {
    const ownerPlan = await ownerPlanForWorkspace(service, invite.workspace_id)
    const seatLimit = resolveEntitlements(ownerPlan).maxMembers
    // This invite is still counted as a pending seat, so accepting it is net-zero
    // on the total — reject only once current usage already exceeds the limit.
    if ((await seatsUsed(service, invite.workspace_id)) > seatLimit) {
      return { ok: false, error: 'seat_limit' }
    }
  }

  const { error: memberError } = await service.from('workspace_members').insert({
    workspace_id: invite.workspace_id,
    user_id: userId,
    role: invite.role,
    status: 'active',
    joined_at: new Date().toISOString(),
  })
  // 23505 = unique_violation: already a member of this workspace.
  if (memberError !== null && memberError.code !== '23505') {
    return { ok: false, error: memberError.message }
  }
  const { error: acceptError } = await service
    .from('workspace_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
  if (acceptError !== null) {
    return { ok: false, error: acceptError.message }
  }
  await syncSeatQuantity(invite.workspace_id).catch(() => undefined)

  // Land the user in the workspace they just joined, so the dashboard shows the
  // team's data immediately instead of their (still-selected) personal one.
  ;(await cookies()).set(WORKSPACE_COOKIE, invite.workspace_id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}

export async function acceptInvitation(rawToken: string): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  // Anonymous principals carry no verified email, so never let one match an invite.
  if (user === null || user.is_anonymous === true) {
    return { ok: false, error: 'unauthenticated' }
  }

  const service = await createServiceClient()
  const { data: invite } = await service
    .from('workspace_invitations')
    .select('id, workspace_id, email, role, expires_at, accepted_at, revoked_at')
    .eq('token_hash', hashToken(rawToken))
    .maybeSingle()
  if (invite === null || !invitePending(invite)) {
    return { ok: false, error: 'invalid_invite' }
  }
  // The invite is bound to a specific email; the signed-in user must match it.
  if (!emailsMatch(user.email, invite.email)) {
    return { ok: false, error: 'email_mismatch' }
  }

  return finalizeInvitationAcceptance(service, invite, user.id)
}

// MARK: - Received invitations (in-app accept / decline)

export interface IReceivedInvitation {
  id: string
  workspaceName: string
  role: string
  expiresAt: string
}

/**
 * Pending invites addressed to the caller's own email, across ANY workspace.
 * RLS only exposes invitations of workspaces the caller already belongs to, so
 * this deliberately runs on the service client and re-scopes to the verified
 * email server-side.
 */
export async function listReceivedInvitations(): Promise<IReceivedInvitation[]> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  // Anonymous principals carry no verified email, so never surface invites to one.
  if (user === null || user.is_anonymous === true) {
    return []
  }
  const email = user.email?.trim().toLowerCase()
  if (email === undefined || email === '') {
    return []
  }

  const service = await createServiceClient()
  const { data: rows } = await service
    .from('workspace_invitations')
    .select('id, workspace_id, role, expires_at')
    .ilike('email', email)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (rows === null || rows.length === 0) {
    return []
  }

  // Name resolved in a second query (matches the team page's member-email
  // pattern) to avoid relying on embedded-relation typing.
  const workspaceIds = rows.map((row) => row.workspace_id)
  const { data: workspaces } = await service
    .from('workspaces')
    .select('id, name')
    .in('id', workspaceIds)
  const nameById = new Map((workspaces ?? []).map((w) => [w.id, w.name]))

  return rows.map((row) => ({
    id: row.id,
    workspaceName: nameById.get(row.workspace_id) ?? '—',
    role: row.role,
    expiresAt: row.expires_at,
  }))
}

/** Loads a pending invite by id and verifies it's addressed to this user. */
async function loadOwnPendingInvite(
  service: TServiceClient,
  invitationId: string,
  userEmail: string | null | undefined,
): Promise<IPendingInvite | null> {
  const { data: invite } = await service
    .from('workspace_invitations')
    .select('id, workspace_id, email, role, expires_at, accepted_at, revoked_at')
    .eq('id', invitationId)
    .maybeSingle()
  if (invite === null || !invitePending(invite) || !emailsMatch(userEmail, invite.email)) {
    return null
  }
  return invite
}

export async function acceptInvitationById(invitationId: string): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  // Anonymous principals carry no verified email, so never let one match an invite.
  if (user === null || user.is_anonymous === true) {
    return { ok: false, error: 'unauthenticated' }
  }

  const service = await createServiceClient()
  const invite = await loadOwnPendingInvite(service, invitationId, user.email)
  if (invite === null) {
    return { ok: false, error: 'invalid_invite' }
  }
  return finalizeInvitationAcceptance(service, invite, user.id)
}

export async function declineInvitation(invitationId: string): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  // Anonymous principals carry no verified email, so never let one match an invite.
  if (user === null || user.is_anonymous === true) {
    return { ok: false, error: 'unauthenticated' }
  }

  const service = await createServiceClient()
  const invite = await loadOwnPendingInvite(service, invitationId, user.email)
  if (invite === null) {
    return { ok: false, error: 'invalid_invite' }
  }

  const { error } = await service
    .from('workspace_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invite.id)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  // Best-effort: a failed audit write must not fail the user action.
  await service.from('audit_events').insert({
    workspace_id: invite.workspace_id,
    actor_user_id: user.id,
    action: 'member.invite_declined',
    target_type: 'invitation',
    target_id: invite.id,
    metadata: null,
  })
  return { ok: true }
}

// MARK: - internal

/** True only for a profile on a paid plan with a live (active/trialing) subscription. */
function hasActivePaidSubscription(
  profile: { plan: string | null; subscription_status: string | null } | null,
): boolean {
  return (
    profile !== null &&
    isPaidPlan(planOrFree(profile.plan)) &&
    (profile.subscription_status === 'active' || profile.subscription_status === 'trialing')
  )
}

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

async function seatsUsed(service: TServiceClient, workspaceId: string): Promise<number> {
  const [{ count: members }, { count: pending }] = await Promise.all([
    service
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
    service
      .from('workspace_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()),
  ])
  return (members ?? 0) + (pending ?? 0)
}

/** True when the user already holds an active membership in the workspace. */
async function isActiveMember(
  service: TServiceClient,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const { count } = await service
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
  return (count ?? 0) > 0
}

async function ownerCount(service: TServiceClient, workspaceId: string): Promise<number> {
  const { count } = await service
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .eq('role', 'owner')
  return count ?? 0
}

async function audit(
  service: TServiceClient,
  ctx: ITeamContext,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  // Best-effort: a failed audit write must not fail the user action.
  await service.from('audit_events').insert({
    workspace_id: ctx.workspaceId,
    actor_user_id: ctx.userId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata as never,
  })
}
