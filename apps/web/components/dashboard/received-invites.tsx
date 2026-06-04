'use client'

import type { IReceivedInvitation } from '@/lib/actions/team'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, EButtonAppearance, EButtonVariant } from '@/components/ui/button'
import { notify } from '@/components/ui/toast'
import { acceptInvitationById, declineInvitation } from '@/lib/actions/team'

// MARK: - Received invites

/** Lists pending workspace invitations with accept/decline actions. */
export function ReceivedInvites({ invitations }: { invitations: IReceivedInvitation[] }) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // The id being acted on, so only its row disables while the action runs.
  const [busyId, setBusyId] = useState<string | null>(null)

  function onAccept(id: string): void {
    setBusyId(id)
    startTransition(async () => {
      const result = await acceptInvitationById(id)
      if (result.ok) {
        notify.success(t('receivedAcceptSuccess'))
        router.refresh()
      } else {
        notify.error(t('receivedActionError'))
      }
      setBusyId(null)
    })
  }

  function onDecline(id: string): void {
    setBusyId(id)
    startTransition(async () => {
      const result = await declineInvitation(id)
      if (!result.ok) {
        notify.error(t('receivedActionError'))
      }
      router.refresh()
      setBusyId(null)
    })
  }

  if (invitations.length === 0) {
    return null
  }

  return (
    <div className="border-site-secondary/40 bg-site-secondary/8 space-y-4 rounded-2xl border p-6">
      <p className="text-site-secondary text-sm font-semibold">{t('receivedTitle')}</p>
      <ul className="divide-site-border divide-y">
        {invitations.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-site-text truncate text-sm font-medium">{invite.workspaceName}</p>
              <p className="text-site-faint text-xs">
                {t(`teamRole.${invite.role}`)} ·{' '}
                {t('teamExpires', { date: new Date(invite.expiresAt).toLocaleDateString() })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant={EButtonVariant.PRIMARY}
                onPress={() => onAccept(invite.id)}
                isDisabled={pending && busyId === invite.id}
              >
                {t('receivedAccept')}
              </Button>
              <Button
                variant={EButtonVariant.DANGER}
                appearance={EButtonAppearance.GHOST}
                onPress={() => onDecline(invite.id)}
                isDisabled={pending && busyId === invite.id}
              >
                {t('receivedDecline')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
