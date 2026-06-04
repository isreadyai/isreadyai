'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

// Bumped to v2 when the onboarding became a first-access modal shown to every
// user until dismissed (was gated to empty workspaces): a fresh key re-surfaces
// it once for accounts that had closed the earlier inline panel.
const DISMISS_KEY = 'isready:dash-onboarding-dismissed:v2'

type TStepIcon = 'scan' | 'track' | 'report' | 'fix'

const STEPS: { key: string; icon: TStepIcon }[] = [
  { key: 'stepScan', icon: 'scan' },
  { key: 'stepTrack', icon: 'track' },
  { key: 'stepReport', icon: 'report' },
  { key: 'stepFix', icon: 'fix' },
]

// Pro value props, mirrored from the marketing tiers table (tiers.fResolution etc.)
// so the upsell copy stays in sync with what the plan actually unlocks.
const PRO_PROPS = ['proResolution', 'proAsk', 'proBadge', 'proMonitoring', 'proHistory'] as const

export function OnboardingPanel({ isPaid }: { isPaid: boolean }) {
  const t = useTranslations('onboarding')
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (dismissed !== false || typeof document === 'undefined') {
      return
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        dismiss()
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
    // dismiss is stable for the lifetime of this open state; deps kept minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed])

  if (dismissed !== false || typeof document === 'undefined') {
    return null
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // localStorage unavailable (private mode) — hide for this session only.
    }
    setDismissed(true)
  }

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled on document; this only catches outside clicks
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- backdrop catches outside clicks; Escape handled on document
    <div
      className="bg-site-background/75 fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dismiss()
        }
      }}
    >
      <section
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- <section role="dialog"> combines landmark + dialog semantics; native <dialog> UA styles would need a full reset
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className="border-site-border bg-site-surface relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-y-auto rounded-t-3xl border p-6 shadow-2xl sm:max-h-[92vh] sm:rounded-3xl sm:p-10"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="text-site-faint hover:text-site-text hover:bg-site-raised absolute top-5 right-5 inline-flex size-9 items-center justify-center rounded-lg transition-colors"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>

        <p className="text-site-secondary font-mono text-xs tracking-wide uppercase">
          {t('kicker')}
        </p>
        <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
          {t('title')}
        </h2>
        <p className="text-site-muted mt-2 max-w-2xl text-sm sm:text-base">{t('subtitle')}</p>

        <ol className="mt-7 grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li
              key={step.key}
              className="border-site-border/70 bg-site-raised/30 flex gap-3 rounded-xl border p-4"
            >
              <span className="bg-site-secondary/12 text-site-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
                <StepIcon name={step.icon} />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="text-site-faint font-mono text-xs">{i + 1}</span>
                  {t(`${step.key}.title`)}
                </p>
                <p className="text-site-muted mt-0.5 text-xs leading-relaxed">
                  {t(`${step.key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {isPaid ? (
          <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
            <Button variant="primary" href="/dashboard/scans">
              {t('startCta')}
            </Button>
            <Button appearance="outline" variant="neutral" onPress={dismiss}>
              {t('dismiss')}
            </Button>
          </div>
        ) : (
          <div className="border-site-secondary/40 bg-site-secondary/8 mt-8 rounded-2xl border p-6 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-site-secondary text-base font-semibold">{t('proTitle')}</p>
              <span className="bg-site-secondary text-site-secondary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                {t('proBadgeLabel')}
              </span>
            </div>
            <p className="text-site-muted mt-1.5 max-w-2xl text-sm">{t('proPitch')}</p>

            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {PRO_PROPS.map((prop) => (
                <li key={prop} className="flex items-start gap-2 text-sm">
                  <CheckIcon />
                  <span className="text-site-text">{t(prop)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <Button variant="secondary" href="/checkout?plan=pro">
                {t('proCta')}
              </Button>
              <Button appearance="ghost" variant="neutral" onPress={dismiss}>
                {t('dismiss')}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}

function CheckIcon() {
  return (
    <span className="bg-site-secondary/15 text-site-secondary mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full">
      <svg
        viewBox="0 0 16 16"
        className="size-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
      </svg>
    </span>
  )
}

function StepIcon({ name }: { name: TStepIcon }): ReactNode {
  const common = {
    viewBox: '0 0 24 24',
    className: 'size-5',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'scan':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      )
    case 'track':
      return (
        <svg {...common}>
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
      )
    case 'report':
      return (
        <svg {...common}>
          <path d="M14 3v5h5" />
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M8 13h8M8 17h6" />
        </svg>
      )
    case 'fix':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z" />
        </svg>
      )
    default:
      return null
  }
}
