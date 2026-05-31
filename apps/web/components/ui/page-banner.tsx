'use client'

import type { ReactNode } from 'react'

// MARK: - PageBanner (workspace/account-wide, persistent — Atlassian banner)

/**
 * Workspace-wide persistent banner (account/workspace-wide, never auto-dismisses).
 * Severity maps to intent colors: critical→danger, warning→warning, success→site-accent, info→site-secondary.
 */
export const EPageBannerSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  SUCCESS: 'success',
} as const
export type TPageBannerSeverity = (typeof EPageBannerSeverity)[keyof typeof EPageBannerSeverity]

const SEVERITY: Record<
  TPageBannerSeverity,
  { surface: string; accent: string; role: 'alert' | 'status' }
> = {
  [EPageBannerSeverity.CRITICAL]: {
    surface: 'border-danger/55 bg-danger/10',
    accent: 'text-danger',
    role: 'alert',
  },
  [EPageBannerSeverity.WARNING]: {
    surface: 'border-warning/55 bg-warning/10',
    accent: 'text-warning',
    role: 'alert',
  },
  [EPageBannerSeverity.SUCCESS]: {
    surface: 'border-site-accent/55 bg-site-accent/10',
    accent: 'text-site-accent',
    role: 'status',
  },
  [EPageBannerSeverity.INFO]: {
    surface: 'border-site-secondary/55 bg-site-secondary/10',
    accent: 'text-site-secondary',
    role: 'status',
  },
}

interface IPageBannerProps {
  severity: TPageBannerSeverity
  title: string
  description?: string
  action?: ReactNode
  onDismiss?: () => void
}

/** Renders a severity-colored banner with optional action and dismiss button. */
export function PageBanner({ severity, title, description, action, onDismiss }: IPageBannerProps) {
  const { surface, accent, role } = SEVERITY[severity]

  return (
    <div role={role} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${surface}`}>
      <SeverityIcon severity={severity} className={`mt-0.5 size-5 shrink-0 ${accent}`} />
      <div className="min-w-0 flex-1">
        <p className="text-site-text text-sm font-semibold">{title}</p>
        {description !== undefined ? (
          <p className="text-site-muted mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {action !== undefined ? <div className="shrink-0">{action}</div> : null}
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
            className="size-4"
          >
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

// MARK: - Severity icons

/** Renders a severity icon (critical/warning/success/info). */
export function SeverityIcon({
  severity,
  className,
}: {
  severity: TPageBannerSeverity
  className: string
}) {
  if (severity === EPageBannerSeverity.SUCCESS) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={className}
      >
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.5 8.2l1.8 1.8 3.2-3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (severity === EPageBannerSeverity.INFO) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={className}
      >
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 7.2v3.4" strokeLinecap="round" />
        <path d="M8 5.1v.1" strokeLinecap="round" />
      </svg>
    )
  }
  // critical + warning share the triangle glyph
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path d="M8 2.2l6 10.4H2L8 2.2z" strokeLinejoin="round" />
      <path d="M8 6.4v3" strokeLinecap="round" />
      <path d="M8 11.1v.1" strokeLinecap="round" />
    </svg>
  )
}
