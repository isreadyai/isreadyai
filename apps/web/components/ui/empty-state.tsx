import type { ReactNode } from 'react'

// MARK: - EmptyState (no data + next action — Atlassian empty state)

/**
 * Dashed-border centered pattern used across the dashboard. 'empty' is the
 * first-run "nothing here yet" case; 'filtered' is "your filters hid
 * everything" — the caller passes a reset-filters control as `action`.
 */

export const EEmptyStateVariant = {
  EMPTY: 'empty',
  FILTERED: 'filtered',
} as const
export type TEmptyStateVariant = (typeof EEmptyStateVariant)[keyof typeof EEmptyStateVariant]

interface IEmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  variant?: TEmptyStateVariant
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = EEmptyStateVariant.EMPTY,
}: IEmptyStateProps) {
  // Filtered state reads as a lighter, dimmer surface — the data exists, it is just hidden.
  const tone =
    variant === EEmptyStateVariant.FILTERED ? 'border-site-border/60' : 'border-site-border'

  return (
    <div
      className={`border-site-border flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center ${tone}`}
    >
      {icon !== undefined ? <div className="text-site-faint mb-4 size-10">{icon}</div> : null}
      <p className="text-site-text text-base font-semibold">{title}</p>
      {description !== undefined ? (
        <p className="text-site-muted mt-1.5 max-w-sm text-sm">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
