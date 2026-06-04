import type { ITeamInvitation, ITeamMember } from '@/components/dashboard/team-client'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@isreadyai/supabase'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { TeamClient } from '@/components/dashboard/team-client'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { canManageTeam } from '@/lib/workspace'
import { listReceivedInvitations } from '@/lib/actions/team'
import { resolveEntitlements } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'

export default async function DashboardTeamPage() {
  const t = await getTranslations('admin')
  const ctx = await resolveWorkspaceContext()
  const userId = ctx?.userId ?? ''
  const workspaceId = ctx?.workspaceId ?? null
  const role = ctx?.role ?? null

  // Inviting teammates needs >1 seat — the workspace OWNER's plan sets the seat
  // count, so a member's entitlement follows the owner, never their own plan.
  const canInvite = ctx !== null && resolveEntitlements(ctx.ownerPlan).maxMembers > 1

  // Invites the caller has received are independent of their current workspace,
  // so they're fetched regardless of membership/role below.
  const receivedInvitations = userId === '' ? [] : await listReceivedInvitations()

  let members: ITeamMember[] = []
  let invitations: ITeamInvitation[] = []
  if (workspaceId !== null && role !== null) {
    // Service client: profiles of OTHER members aren't readable via RLS, and the
    // caller is already proven to be a member of this workspace above.
    const service = await createServiceClient()
    const { data: memberRows } = await service
      .from('workspace_members')
      .select('id, user_id, role, status, joined_at')
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true })
    const userIds = (memberRows ?? []).map((row) => row.user_id)
    const { data: profiles } = await service.from('profiles').select('id, email').in('id', userIds)
    const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]))
    members = (memberRows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: emailById.get(row.user_id) ?? '—',
      role: row.role,
      status: row.status,
      joinedAt: row.joined_at,
    }))

    const { data: inviteRows } = await service
      .from('workspace_invitations')
      .select('id, email, role, expires_at')
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    invitations = (inviteRows ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
    }))
  }

  return (
    <DashboardPage title={t('team')} description={t('teamDescription')}>
      <TeamClient
        members={members}
        invitations={invitations}
        receivedInvitations={receivedInvitations}
        canManage={canManageTeam(role)}
        canInvite={canInvite}
        currentUserId={userId}
        currentUserRole={role}
      />
    </DashboardPage>
  )
}
