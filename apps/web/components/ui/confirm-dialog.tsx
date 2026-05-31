'use client'

import type { ReactNode } from 'react'
import { Spinner } from '@heroui/react/spinner'
import { useCallback, useState } from 'react'
import { Button, EButtonAppearance, EButtonSize, EButtonVariant } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

// MARK: - ConfirmDialog (destructive / critical confirmation)

/**
 * Replaces the confirm-in-a-toast antipattern with a real focus-trapped dialog.
 * The primary action is explicit and, when `destructive`, uses the DANGER
 * variant and is visually separated (column-reversed on mobile, right-aligned
 * on desktop) from the cancel action. While `pending`, both buttons disable and
 * the primary shows an inline spinner; the dialog also becomes non-dismissable
 * so the in-flight action can't be interrupted by Escape or an outside click.
 */

interface IConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: IConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      dismissable={!pending}
      footer={
        <>
          <Button
            variant={EButtonVariant.NEUTRAL}
            appearance={EButtonAppearance.OUTLINE}
            size={EButtonSize.SM}
            isDisabled={pending}
            onPress={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? EButtonVariant.DANGER : EButtonVariant.PRIMARY}
            size={EButtonSize.SM}
            isDisabled={pending}
            onPress={onConfirm}
          >
            {pending ? <Spinner size="sm" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

// MARK: - useConfirm (imperative open/close helper)

interface IConfirmState {
  open: boolean
  setOpen: (open: boolean) => void
  show: () => void
  hide: () => void
}

/**
 * Minimal open-state helper for a single ConfirmDialog instance. Keeps the
 * pending state in the caller (it usually comes from useTransition), so this
 * only owns visibility.
 */
export function useConfirm(): IConfirmState {
  const [open, setOpen] = useState(false)
  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])
  return { open, setOpen, show, hide }
}
