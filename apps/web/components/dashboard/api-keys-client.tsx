'use client'

import { Card } from '@heroui/react/card'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button, EButtonSize, EButtonVariant } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CopyButton } from '@/components/ui/copy-button'
import {
  DataTable,
  ETableAlign,
  ETableState,
  RowActionButton,
  type IDataTableColumn,
} from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { notify } from '@/components/ui/toast'
import { createApiKey, renameApiKey, revokeApiKey, rotateApiKey } from '@/lib/actions/api-keys'
import type { IApiKeyView } from '@/lib/api-key-types'
import { dayjs } from '@/lib/dayjs'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { useBrowserTimeZone } from '@/lib/use-browser-time-zone'

// MARK: - API keys management island

interface IApiKeysClientProps {
  keys: IApiKeyView[]
}

/** API key creation, rotation, renaming, and revocation management. */
export function ApiKeysClient({ keys }: IApiKeysClientProps) {
  const t = useTranslations('dashboard')
  const { copied, copy } = useCopyToClipboard()
  const [label, setLabel] = useState('')
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [rotating, setRotating] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [pending, startTransition] = useTransition()
  const timeZone = useBrowserTimeZone()

  function onCreate(): void {
    startTransition(async () => {
      const result = await createApiKey(label)
      if (result.ok) {
        setRawKey(result.rawKey)
        setLabel('')
      } else {
        notify.error(t('keyCreateError'))
      }
    })
  }

  function onConfirmRotate(): void {
    if (rotating === null) {
      return
    }
    const id = rotating
    startTransition(async () => {
      const result = await rotateApiKey(id)
      if (result.ok) {
        setRotating(null)
        setRawKey(result.rawKey)
      } else {
        notify.error(t('keyRevokeError'))
      }
    })
  }

  function onRename(id: string): void {
    startTransition(async () => {
      const result = await renameApiKey(id, editLabel)
      if (result.ok) {
        setEditing(null)
      } else {
        notify.error(t('keyCreateError'))
      }
    })
  }

  function onConfirmRevoke(): void {
    if (revoking === null) {
      return
    }
    const id = revoking
    startTransition(async () => {
      const result = await revokeApiKey(id)
      if (result.ok) {
        setRevoking(null)
      } else {
        notify.error(t('keyRevokeError'))
      }
    })
  }

  const keyColumns: Array<IDataTableColumn<IApiKeyView>> = [
    {
      key: 'name',
      header: t('keyColName'),
      render: (key) =>
        editing === key.id ? (
          <div className="flex items-center gap-2">
            <TextInput
              value={editLabel}
              onChange={(event) => setEditLabel(event.target.value)}
              aria-label={t('keyLabelPlaceholder')}
              surface="subtle"
            />
            <Button
              variant={EButtonVariant.PRIMARY}
              size={EButtonSize.SM}
              onPress={() => onRename(key.id)}
              isDisabled={pending}
            >
              {t('keyRenameSave')}
            </Button>
          </div>
        ) : (
          <span className="truncate font-medium">{key.label ?? t('keyUnnamed')}</span>
        ),
    },
    {
      key: 'details',
      header: t('keyColDetails'),
      render: (key) => (
        <span className="text-site-faint text-xs">
          {key.prefix !== null ? <span className="font-mono">{key.prefix}… · </span> : null}
          {key.plan} ·{' '}
          {dayjs
            .utc(key.createdAt)
            .tz(timeZone ?? 'UTC')
            .format('DD/MM/YYYY')}
          {key.lastUsedAt !== null
            ? ` · ${t('keyLastUsed', {
                date: dayjs
                  .utc(key.lastUsedAt)
                  .tz(timeZone ?? 'UTC')
                  .format('DD/MM/YYYY'),
              })}`
            : ` · ${t('keyNeverUsed')}`}
        </span>
      ),
    },
    {
      key: 'usage',
      header: t('keyColUsage'),
      align: ETableAlign.END,
      render: (key) => (
        <span className="text-site-muted font-mono text-xs">
          {t('keyUsage', { used: key.used, limit: key.limit })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: ETableAlign.END,
      render: (key) => (
        <div className="flex items-center justify-end gap-1.5">
          <RowActionButton
            label={t('keyRename')}
            onPress={() => {
              setEditing(key.id)
              setEditLabel(key.label ?? '')
            }}
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
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            }
          />
          <RowActionButton
            label={t('keyRotate')}
            onPress={() => setRotating(key.id)}
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
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            }
          />
          <RowActionButton
            label={t('keyRevoke')}
            tone="danger"
            onPress={() => setRevoking(key.id)}
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
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card className="border-site-border bg-site-surface/60 border">
        <Card.Content className="space-y-4">
          <p className="text-sm font-medium">{t('keyCreateHeading')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <TextInput
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('keyLabelPlaceholder')}
              aria-label={t('keyLabelPlaceholder')}
            />
            <Button
              variant={EButtonVariant.PRIMARY}
              onPress={onCreate}
              isDisabled={pending}
              className="shrink-0"
            >
              {t('keyCreate')}
            </Button>
          </div>
          {rawKey !== null ? (
            <div className="border-site-accent-dim bg-site-raised/50 space-y-2 rounded-xl border p-4">
              <p className="text-site-muted text-xs">{t('keyShownOnce')}</p>
              <div className="flex items-center justify-between gap-3">
                <code className="text-site-accent truncate font-mono text-sm">{rawKey}</code>
                <CopyButton
                  copied={copied === 'raw-key'}
                  onCopy={() => void copy(rawKey, 'raw-key')}
                  copyLabel={t('copy')}
                  copiedLabel={t('copied')}
                />
              </div>
            </div>
          ) : null}
        </Card.Content>
      </Card>

      <DataTable
        columns={keyColumns}
        rows={keys}
        getRowKey={(key) => key.id}
        state={keys.length === 0 ? ETableState.EMPTY : ETableState.IDLE}
        emptyState={<EmptyState title={t('keysEmpty')} />}
      />

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null)
          }
        }}
        title={t('keyRevokeConfirm')}
        confirmLabel={t('keyRevoke')}
        cancelLabel={t('cancel')}
        destructive
        pending={pending}
        onConfirm={onConfirmRevoke}
      />

      <ConfirmDialog
        open={rotating !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRotating(null)
          }
        }}
        title={t('keyRotateConfirm')}
        description={t('keyRotateConfirmBody')}
        confirmLabel={t('keyRotate')}
        cancelLabel={t('cancel')}
        destructive
        pending={pending}
        onConfirm={onConfirmRotate}
      />
    </div>
  )
}
