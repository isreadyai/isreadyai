'use client'

import type { IDataTableColumn } from '@/components/ui/data-table'
import type { IReceivedInvitation } from '@/lib/actions/team'
import { Card } from '@heroui/react/card'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, EButtonAppearance, EButtonSize, EButtonVariant } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { DataTable, ETableAlign, ETableState, RowActionButton } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { notify } from '@/components/ui/toast'
import {
  changeMemberRole,
  inviteMember,
  leaveWorkspace,
  removeMember,
  revokeInvitation,
  transferOwnership,
} from '@/lib/actions/team'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { ReceivedInvites } from '@/components/dashboard/received-invites'

// MARK: - Team management

export interface ITeamMember {
  id: string
  userId: string
  email: string
  role: string
  status: string
  joinedAt: string | null
}

export interface ITeamInvitation {
  id: string
  email: string
  role: string
  expiresAt: string
}

const INVITE_ROLES = ['admin', 'member', 'viewer', 'billing'] as const
const MEMBER_ROLES = ['owner', 'admin', 'member', 'viewer', 'billing'] as const

/** Team management UI: members, invitations, roles, ownership transfer. */
export function TeamClient({
  members,
  invitations,
  receivedInvitations,
  canManage,
  canInvite,
  currentUserId,
  currentUserRole,
}: {
  members: ITeamMember[]
  invitations: ITeamInvitation[]
  /** Pending invites addressed to the current user, from any workspace. */
  receivedInvitations: IReceivedInvitation[]
  canManage: boolean
  /** Inviting teammates is a Team-plan capability; Free/Pro see an upgrade nudge. */
  canInvite: boolean
  currentUserId: string
  currentUserRole: string | null
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const { copied, copy } = useCopyToClipboard()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>('member')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  // Two-click confirm for ownership transfer: holds the member id awaiting confirm.
  const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const isOwner = currentUserRole === 'owner'
  const activeMemberCount = members.filter((m) => m.status === 'active').length
  const ownerCount = members.filter((m) => m.status === 'active' && m.role === 'owner').length
  const isLastOwner = isOwner && ownerCount <= 1
  const canLeave = activeMemberCount > 1 && !isLastOwner

  function onInvite(): void {
    setInviteUrl(null)
    startTransition(async () => {
      const result = await inviteMember(email, role)
      if (result.ok) {
        setInviteUrl(result.inviteUrl)
        setEmail('')
      } else if (result.error === 'seat_limit') {
        // Plan/seat gating → warning; only genuine failures are errors.
        notify.warning(t('teamSeatLimit'))
      } else {
        notify.error(t('teamInviteError'))
      }
    })
  }

  function onRoleChange(member: ITeamMember, next: string): void {
    startTransition(async () => {
      const result = await changeMemberRole(member.id, next)
      if (!result.ok) {
        if (result.error === 'last_owner') {
          // Guard rail (can't demote the last owner), not a system error.
          notify.warning(t('teamLastOwner'))
        } else {
          notify.error(t('teamRoleError'))
        }
      }
    })
  }

  function onRemove(member: ITeamMember): void {
    startTransition(async () => {
      const result = await removeMember(member.id)
      if (!result.ok) {
        if (result.error === 'last_owner') {
          notify.warning(t('teamLastOwner'))
        } else {
          notify.error(t('teamRemoveError'))
        }
      }
    })
  }

  function onRevoke(id: string): void {
    startTransition(async () => {
      const result = await revokeInvitation(id)
      if (!result.ok) {
        notify.error(t('teamRemoveError'))
      }
    })
  }

  function onTransfer(member: ITeamMember): void {
    setConfirmTransfer(null)
    startTransition(async () => {
      const result = await transferOwnership(member.id)
      if (result.ok) {
        notify.success(t('transferred'))
        router.refresh()
      } else {
        notify.error(t('makeOwnerError'))
      }
    })
  }

  function onLeave(): void {
    setConfirmLeave(false)
    startTransition(async () => {
      const result = await leaveWorkspace()
      if (result.ok) {
        notify.success(t('left'))
        router.push('/dashboard')
      } else if (result.error === 'last_owner') {
        notify.warning(t('lastOwnerCannotLeave'))
      } else if (result.error === 'cannot_leave_personal') {
        notify.warning(t('cannotLeavePersonal'))
      } else {
        notify.error(t('leaveError'))
      }
    })
  }

  const memberColumns: Array<IDataTableColumn<ITeamMember>> = [
    {
      key: 'member',
      header: t('teamColMember'),
      render: (member) => (
        <span className="text-site-text truncate text-sm">
          {member.email}
          {member.userId === currentUserId ? (
            <span className="text-site-faint ml-2 text-xs">{t('teamYou')}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('teamColStatus'),
      render: (member) => (
        <span className="text-site-faint text-xs">
          {t(`teamStatus.${member.status}`)}
          {member.joinedAt !== null
            ? ` · ${t('teamJoined', { date: new Date(member.joinedAt).toLocaleDateString() })}`
            : ''}
        </span>
      ),
    },
    {
      key: 'role',
      header: t('teamColRole'),
      render: (member) =>
        canManage && member.userId !== currentUserId ? (
          <select
            value={member.role}
            onChange={(event) => onRoleChange(member, event.target.value)}
            disabled={pending}
            aria-label={t('teamRoleLabel')}
            className="border-site-border bg-site-surface min-h-9 rounded-lg border px-2 text-xs outline-none"
          >
            {MEMBER_ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`teamRole.${value}`)}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-site-muted text-xs">{t(`teamRole.${member.role}`)}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: ETableAlign.END,
      render: (member) =>
        canManage && member.userId !== currentUserId ? (
          <div className="flex items-center justify-end gap-2">
            {isOwner && member.status === 'active' && member.role !== 'owner' ? (
              confirmTransfer === member.id ? (
                <Button
                  variant={EButtonVariant.PRIMARY}
                  appearance={EButtonAppearance.GHOST}
                  size={EButtonSize.SM}
                  onPress={() => onTransfer(member)}
                  isDisabled={pending}
                >
                  {t('makeOwnerConfirm')}
                </Button>
              ) : (
                <Button
                  variant={EButtonVariant.NEUTRAL}
                  appearance={EButtonAppearance.GHOST}
                  size={EButtonSize.SM}
                  onPress={() => setConfirmTransfer(member.id)}
                  isDisabled={pending}
                >
                  {t('makeOwner')}
                </Button>
              )
            ) : null}
            <RowActionButton
              label={t('teamRemove')}
              tone="danger"
              onPress={() => onRemove(member)}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                </svg>
              }
            />
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <ReceivedInvites invitations={receivedInvitations} />

      {canManage && !canInvite && receivedInvitations.length === 0 ? (
        <div className="border-site-secondary/40 bg-site-secondary/8 flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-site-secondary text-sm font-semibold">{t('teamUpsellTitle')}</p>
            <p className="text-site-muted mt-1 text-sm">{t('teamUpsellBody')}</p>
          </div>
          <Button
            variant={EButtonVariant.SECONDARY}
            href="/checkout?plan=team"
            className="shrink-0"
          >
            {t('teamUpsellCta')}
          </Button>
        </div>
      ) : null}

      {canManage && canInvite ? (
        <div className="border-site-secondary/40 bg-site-secondary/8 rounded-2xl border p-5">
          <p className="text-site-secondary text-sm font-semibold">{t('teamSharedDataTitle')}</p>
          <p className="text-site-muted mt-1 text-sm leading-relaxed">{t('teamSharedDataBody')}</p>
        </div>
      ) : null}

      {canManage && canInvite ? (
        <Card className="border-site-border bg-site-surface/60 border">
          <Card.Content className="space-y-4">
            <p className="text-sm font-medium">{t('teamInviteHeading')}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('teamEmailPlaceholder')}
                aria-label={t('teamEmailPlaceholder')}
                className="flex-1"
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as (typeof INVITE_ROLES)[number])}
                aria-label={t('teamRoleLabel')}
                className="border-site-border bg-site-surface min-h-11 rounded-xl border px-4 text-sm outline-none"
              >
                {INVITE_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {t(`teamRole.${value}`)}
                  </option>
                ))}
              </select>
              <Button
                variant={EButtonVariant.PRIMARY}
                onPress={onInvite}
                isDisabled={pending || email.trim().length === 0}
                className="shrink-0"
              >
                {t('teamInvite')}
              </Button>
            </div>
            {inviteUrl !== null ? (
              <div className="border-site-accent-dim bg-site-raised/50 space-y-2 rounded-xl border p-3">
                <p className="text-site-muted text-xs">{t('teamInviteLinkHint')}</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-site-accent truncate font-mono text-xs">{inviteUrl}</code>
                  <CopyButton
                    copied={copied === 'invite'}
                    onCopy={() => void copy(inviteUrl, 'invite')}
                    copyLabel={t('copy')}
                    copiedLabel={t('copied')}
                  />
                </div>
              </div>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      <div className="space-y-3">
        <p className="text-site-text text-sm font-semibold">{t('teamMembersTitle')}</p>
        <DataTable
          columns={memberColumns}
          rows={members}
          getRowKey={(member) => member.id}
          state={members.length === 0 ? ETableState.EMPTY : ETableState.IDLE}
          emptyState={<EmptyState title={t('teamMembersTitle')} />}
        />
      </div>

      {invitations.length > 0 ? (
        <Card className="border-site-border bg-site-surface/60 border">
          <Card.Content className="space-y-4">
            <p className="text-site-text text-sm font-semibold">{t('teamPendingTitle')}</p>
            <ul className="divide-site-border divide-y">
              {invitations.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-site-text truncate text-sm">{invite.email}</p>
                    <p className="text-site-faint text-xs">
                      {t(`teamRole.${invite.role}`)} ·{' '}
                      {t('teamExpires', { date: new Date(invite.expiresAt).toLocaleDateString() })}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      variant={EButtonVariant.DANGER}
                      appearance={EButtonAppearance.GHOST}
                      size={EButtonSize.SM}
                      onPress={() => onRevoke(invite.id)}
                      isDisabled={pending}
                      className="shrink-0"
                    >
                      {t('teamRevoke')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      ) : null}

      {members.length === 0 ? <EmptyState title={t('teamEmpty')} /> : null}

      {canLeave ? (
        <div className="border-site-border flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-site-text text-sm font-medium">{t('leaveTitle')}</p>
            <p className="text-site-faint text-xs">
              {confirmLeave ? t('leaveConfirm') : t('leaveDescription')}
            </p>
          </div>
          {confirmLeave ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant={EButtonVariant.NEUTRAL}
                appearance={EButtonAppearance.GHOST}
                onPress={() => setConfirmLeave(false)}
                isDisabled={pending}
              >
                {t('cancel')}
              </Button>
              <Button
                variant={EButtonVariant.DANGER}
                appearance={EButtonAppearance.GHOST}
                onPress={onLeave}
                isDisabled={pending}
              >
                {t('leave')}
              </Button>
            </div>
          ) : (
            <Button
              variant={EButtonVariant.DANGER}
              appearance={EButtonAppearance.GHOST}
              onPress={() => setConfirmLeave(true)}
              isDisabled={pending}
              className="shrink-0"
            >
              {t('leave')}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
