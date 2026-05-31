'use client'

import type { ReactNode } from 'react'
import type { TPageBannerSeverity } from '@/components/ui/page-banner'
import { EPageBannerSeverity, SeverityIcon } from '@/components/ui/page-banner'

// MARK: - SectionMessage (local to a page region — Atlassian section message)

/**
 * Same severity API as PageBanner but lighter weight: it sits inside a page
 * region rather than spanning the workspace, so it reads as contextual rather
 * than account-wide. Tinted left rail instead of a full surface fill.
 */

export const ESectionMessageSeverity = EPageBannerSeverity
export type TSectionMessageSeverity = TPageBannerSeverity

const ACCENT: Record<
  TSectionMessageSeverity,
  { rail: string; icon: string; role: 'alert' | 'status' }
> = {
  [EPageBannerSeverity.CRITICAL]: { rail: 'border-l-danger', icon: 'text-danger', role: 'alert' },
  [EPageBannerSeverity.WARNING]: { rail: 'border-l-warning', icon: 'text-warning', role: 'alert' },
  [EPageBannerSeverity.SUCCESS]: {
    rail: 'border-l-site-accent',
    icon: 'text-site-accent',
    role: 'status',
  },
  [EPageBannerSeverity.INFO]: {
    rail: 'border-l-site-secondary',
    icon: 'text-site-secondary',
    role: 'status',
  },
}

interface ISectionMessageProps {
  severity: TSectionMessageSeverity
  title: string
  description?: string
  action?: ReactNode
  onDismiss?: () => void
}

export function SectionMessage({
  severity,
  title,
  description,
  action,
  onDismiss,
}: ISectionMessageProps) {
  const { rail, icon, role } = ACCENT[severity]

  return (
    <div
      role={role}
      className={`bg-site-raised/40 flex items-start gap-3 rounded-lg border-l-2 py-2.5 pr-3 pl-3 ${rail}`}
    >
      <SeverityIcon severity={severity} className={`mt-0.5 size-4 shrink-0 ${icon}`} />
      <div className="min-w-0 flex-1">
        <p className="text-site-text text-sm font-medium">{title}</p>
        {description !== undefined ? (
          <p className="text-site-muted mt-0.5 text-xs">{description}</p>
        ) : null}
        {action !== undefined ? <div className="mt-2">{action}</div> : null}
      </div>
      {onDismiss !== undefined ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-site-faint hover:text-site-text shrink-0 cursor-pointer transition-colors"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="size-3.5"
          >
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
