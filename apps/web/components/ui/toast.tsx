'use client'

import { Alert } from '@heroui/react/alert'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { Button, EButtonAppearance, EButtonSize, EButtonVariant } from '@/components/ui/button'

// MARK: - Toasts (sonner transport, HeroUI Alert surface)

type TToastStatus = 'success' | 'danger' | 'warning' | 'default'

// A coloured border lifts the alert off the dark surface; the hue tracks intent.
const BORDER: Record<TToastStatus, string> = {
  success: 'border border-site-accent/55',
  danger: 'border border-danger/60',
  warning: 'border border-warning/60',
  default: 'border border-site-accent/55',
}

function show(status: TToastStatus, message: string): void {
  toast.custom(() => (
    <Alert status={status} className={`w-[22rem] max-w-[90vw] shadow-2xl ${BORDER[status]}`}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{message}</Alert.Title>
      </Alert.Content>
    </Alert>
  ))
}

interface IConfirmOptions {
  title: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
}

function confirm(options: IConfirmOptions): void {
  toast.custom(
    (id) => (
      <Alert status="danger" className="border-danger/70 w-[22rem] max-w-[90vw] border shadow-2xl">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{options.title}</Alert.Title>
          <div className="mt-3 flex gap-2">
            <Button
              variant={EButtonVariant.DANGER}
              size={EButtonSize.SM}
              onPress={() => {
                options.onConfirm()
                toast.dismiss(id)
              }}
            >
              {options.confirmLabel}
            </Button>
            <Button
              variant={EButtonVariant.NEUTRAL}
              appearance={EButtonAppearance.OUTLINE}
              size={EButtonSize.SM}
              onPress={() => toast.dismiss(id)}
            >
              {options.cancelLabel}
            </Button>
          </div>
        </Alert.Content>
      </Alert>
    ),
    { duration: Number.POSITIVE_INFINITY },
  )
}

interface IActionOptions {
  title: string
  actionLabel: string
  onAction: () => void
}

function action(options: IActionOptions): void {
  toast.custom(
    (id) => (
      <Alert
        status="default"
        className="border-site-accent/55 w-[22rem] max-w-[90vw] border shadow-2xl"
      >
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{options.title}</Alert.Title>
          <div className="mt-3">
            <Button
              variant={EButtonVariant.PRIMARY}
              size={EButtonSize.SM}
              onPress={() => {
                options.onAction()
                toast.dismiss(id)
              }}
            >
              {options.actionLabel}
            </Button>
          </div>
        </Alert.Content>
      </Alert>
    ),
    { duration: 12_000 },
  )
}

/** Toast notification API (success, error, warning, info, confirm, action). */
export const notify = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('danger', message),
  warning: (message: string) => show('warning', message),
  info: (message: string) => show('default', message),
  confirm,
  action,
}

/** Sonner toast container (renders queued toasts at top-center). */
export function Toaster() {
  return <SonnerToaster position="top-center" theme="dark" toastOptions={{ unstyled: true }} />
}
