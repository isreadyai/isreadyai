'use client'

import { Card } from '@heroui/react/card'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button, EButtonVariant } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { notify } from '@/components/ui/toast'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications'
import { dayjs } from '@/lib/dayjs'
import { useBrowserTimeZone } from '@/lib/use-browser-time-zone'

// MARK: - Alerts inbox

export interface INotification {
  id: string
  severity: string
  title: string
  body: string | null
  createdAt: string
  readAt: string | null
}

const RAIL: Record<string, string> = {
  error: 'border-l-danger',
  warning: 'border-l-warning',
  success: 'border-l-site-accent',
  info: 'border-l-site-secondary',
}

/** Notifications inbox with mark-as-read controls. */
export function AlertsClient({ notifications }: { notifications: INotification[] }) {
  const t = useTranslations('dashboard')
  const [pending, startTransition] = useTransition()
  const timeZone = useBrowserTimeZone()
  const hasUnread = notifications.some((n) => n.readAt === null)

  function onMarkRead(id: string): void {
    startTransition(async () => {
      const result = await markNotificationRead(id)
      if (!result.ok) {
        notify.error(t('alertsError'))
      }
    })
  }

  function onMarkAll(): void {
    startTransition(async () => {
      const result = await markAllNotificationsRead()
      if (!result.ok) {
        notify.error(t('alertsError'))
      }
    })
  }

  if (notifications.length === 0) {
    return <EmptyState title={t('alertsEmptyTitle')} description={t('alertsEmptyBody')} />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant={EButtonVariant.NEUTRAL}
          onPress={onMarkAll}
          isDisabled={pending || !hasUnread}
        >
          {t('alertsMarkAll')}
        </Button>
      </div>
      <Card className="border-site-border bg-site-surface/60 border">
        <Card.Content>
          <ul className="divide-site-border divide-y">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={`flex items-start justify-between gap-3 border-l-2 py-3 pl-3 ${
                  RAIL[item.severity] ?? RAIL.info
                } ${item.readAt === null ? '' : 'opacity-60'}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {item.readAt === null ? (
                      <span
                        className="bg-site-accent size-1.5 shrink-0 rounded-full"
                        aria-hidden="true"
                      />
                    ) : null}
                    <p className="text-site-text truncate text-sm font-medium">{item.title}</p>
                  </div>
                  {item.body !== null ? (
                    <p className="text-site-muted mt-0.5 text-xs">{item.body}</p>
                  ) : null}
                  <p className="text-site-faint mt-1 text-[11px]">
                    {dayjs
                      .utc(item.createdAt)
                      .tz(timeZone ?? 'UTC')
                      .format('DD/MM/YYYY, HH:mm:ss')}
                  </p>
                </div>
                {item.readAt === null ? (
                  <button
                    type="button"
                    onClick={() => onMarkRead(item.id)}
                    disabled={pending}
                    className="text-site-muted hover:text-site-text shrink-0 text-xs transition-colors disabled:opacity-50"
                  >
                    {t('alertsMarkRead')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  )
}
