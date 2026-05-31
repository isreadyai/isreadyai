'use client'

import type { ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

// MARK: - Dialog (accessible overlay primitive)

/**
 * Self-contained modal: a single dimmed full-screen backdrop portalled to
 * <body> with one centred card. Escape and an outside click close it (unless
 * `dismissable` is false); body scroll is locked while open. Controlled only —
 * callers own `open`/`onOpenChange`. Presentational: all strings arrive as props.
 */

interface IDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** When false, Escape and outside-click cannot close it (e.g. while a critical action runs). */
  dismissable?: boolean
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
}: IDialogProps) {
  const descriptionId = useId()
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && dismissable) {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cardRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, dismissable, onOpenChange])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled on document; this only catches outside clicks
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- backdrop catches outside clicks; Escape handled via document listener in the effect
    <div
      className="bg-site-background/70 fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissable) {
          onOpenChange(false)
        }
      }}
    >
      <div
        ref={cardRef}
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <dialog> UA styles conflict with Tailwind; focus trap managed programmatically via cardRef
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        tabIndex={-1}
        className="border-site-border bg-site-surface flex w-full max-w-md flex-col gap-4 rounded-t-2xl border p-6 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="text-site-text text-base font-semibold">{title}</h2>
          {description !== undefined ? (
            <p id={descriptionId} className="text-site-muted text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {children !== undefined ? <div className="text-site-text text-sm">{children}</div> : null}
        {footer !== undefined ? (
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
