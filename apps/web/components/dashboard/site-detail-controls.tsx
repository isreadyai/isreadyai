'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, EButtonAppearance, EButtonSize, EButtonVariant } from '@/components/ui/button'
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { notify } from '@/components/ui/toast'
import {
  removeTrackedDomain,
  renameWebsite,
  requestDomainVerification,
  verifyDomain,
  type TScanMode,
} from '@/lib/actions/domains'

// MARK: - Website detail action bar
//
// The control center for a single tracked site: re-run the audit now, verify
// ownership (DNS-TXT), rename or delete. State changes call router.refresh() so
// the server-rendered header reflects them immediately.

export function SiteDetailControls({
  siteId,
  host,
  name,
  verified,
  scanMode,
}: {
  siteId: string
  host: string
  name: string | null
  verified: boolean
  scanMode: TScanMode
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()
  const [record, setRecord] = useState<{ name: string; value: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(name ?? host)

  function onRescan(): void {
    startTransition(async () => {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: `https://${host}` }),
      })
      if (!response.ok) {
        notify[response.status === 429 ? 'warning' : 'error'](
          t(response.status === 429 ? 'siteRescanRateLimited' : 'siteRescanError'),
        )
        return
      }
      const data = (await response.json()) as { id: string }
      // Honour the site's automatic scan depth: 'deep' auto-starts the crawl.
      const deep = scanMode === 'deep' ? '?deep=true' : ''
      router.push(`/dashboard/websites/${siteId}/scans/${data.id}${deep}`)
    })
  }

  function onVerifyRequest(): void {
    startTransition(async () => {
      const result = await requestDomainVerification(siteId)
      if (result.ok) {
        setRecord({ name: result.recordName, value: result.recordValue })
      } else {
        notify.error(t('siteAddError'))
      }
    })
  }

  function onVerifyCheck(): void {
    startTransition(async () => {
      const result = await verifyDomain(siteId)
      if (result.ok) {
        notify.success(t('siteVerifyOk'))
        setRecord(null)
        router.refresh()
      } else {
        // Not an error: the record just hasn't propagated yet.
        notify.warning(t('siteVerifyFail'))
      }
    })
  }

  function onRemove(): void {
    startTransition(async () => {
      const result = await removeTrackedDomain(siteId)
      if (result.ok) {
        confirm.hide()
        router.push('/dashboard/websites')
      } else {
        notify.error(t('siteRemoveError'))
      }
    })
  }

  function onSaveName(): void {
    startTransition(async () => {
      const result = await renameWebsite(siteId, nameInput)
      if (!result.ok) {
        notify.error(t('siteRenameError'))
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function cancelEdit(): void {
    setNameInput(name ?? host)
    setEditing(false)
  }

  return (
    <>
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder={host}
              maxLength={80}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: moves focus to the name input when entering edit mode
              autoFocus
              aria-label={t('siteNameLabel')}
              disabled={pending}
              className="border-site-border bg-site-surface text-site-text placeholder:text-site-faint focus:border-site-accent w-full max-w-md rounded-lg border px-3 py-1.5 text-2xl font-bold tracking-tight outline-none"
            />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{name ?? host}</h2>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!editing ? (
            <>
              <Button variant={EButtonVariant.PRIMARY} onPress={onRescan} isDisabled={pending}>
                {t('siteRescan')}
              </Button>

              {!verified ? (
                <Button
                  variant={EButtonVariant.NEUTRAL}
                  onPress={onVerifyRequest}
                  isDisabled={pending}
                >
                  {t('siteVerify')}
                </Button>
              ) : null}

              <Button
                variant={EButtonVariant.NEUTRAL}
                appearance={EButtonAppearance.OUTLINE}
                onPress={() => setEditing(true)}
                isDisabled={pending}
              >
                {t('siteEdit')}
              </Button>
            </>
          ) : (
            <>
              <Button variant={EButtonVariant.PRIMARY} onPress={onSaveName} isDisabled={pending}>
                {t('siteEditSave')}
              </Button>
              <Button
                variant={EButtonVariant.NEUTRAL}
                appearance={EButtonAppearance.OUTLINE}
                onPress={cancelEdit}
                isDisabled={pending}
              >
                {t('cancel')}
              </Button>
              <Button variant={EButtonVariant.DANGER} onPress={confirm.show} isDisabled={pending}>
                {t('siteRemove')}
              </Button>
            </>
          )}
        </div>
      </header>

      {!verified && !editing ? (
        <div className="border-site-accent-dim/50 bg-site-accent/5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="text-site-accent mt-0.5 shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2 3 7v6c0 5 3.5 8 9 9 5.5-1 9-4 9-9V7Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium">{t('siteVerifyBannerTitle')}</p>
              <p className="text-site-muted mt-0.5 text-xs leading-relaxed">
                {t('siteVerifyBannerBody')}
              </p>
            </div>
          </div>
          <Button
            variant={EButtonVariant.PRIMARY}
            onPress={onVerifyRequest}
            isDisabled={pending}
            className="shrink-0"
          >
            {t('siteVerify')}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={record !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRecord(null)
          }
        }}
        title={t('siteVerifyTitle')}
        description={t('siteVerifyRecordHint')}
        dismissable={!pending}
        footer={
          <>
            <Button
              variant={EButtonVariant.NEUTRAL}
              appearance={EButtonAppearance.OUTLINE}
              size={EButtonSize.SM}
              onPress={() => setRecord(null)}
              isDisabled={pending}
            >
              {t('siteVerifyClose')}
            </Button>
            <Button
              variant={EButtonVariant.PRIMARY}
              size={EButtonSize.SM}
              onPress={onVerifyCheck}
              isDisabled={pending}
            >
              {t('siteVerifyCheck')}
            </Button>
          </>
        }
      >
        {record !== null ? (
          <dl className="border-site-border bg-site-raised/40 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl border p-3 font-mono text-xs">
            <dt className="text-site-faint">{t('siteVerifyName')}</dt>
            <dd className="text-site-text break-all">{record.name}</dd>
            <dt className="text-site-faint">{t('siteVerifyValue')}</dt>
            <dd className="text-site-accent break-all">{record.value}</dd>
          </dl>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={confirm.setOpen}
        title={t('siteRemoveConfirmTitle')}
        description={t('siteRemoveConfirmBody', { host })}
        confirmLabel={t('siteRemoveConfirmCta')}
        cancelLabel={t('siteRemoveCancel')}
        destructive
        pending={pending}
        onConfirm={onRemove}
      />
    </>
  )
}
