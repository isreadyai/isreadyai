'use client'

// MARK: - UsageMeter (quota progress bar with threshold colours)

/**
 * Hand-rolled bar rather than HeroUI's Meter: the spec needs token-driven
 * threshold colours (accent → warning → danger) and exact aria-valuenow/min/max,
 * which the variant-based `color` prop on HeroUI's Meter can't express cleanly.
 */

interface IUsageMeterProps {
  label: string
  used: number
  limit: number
  unit?: string
  periodResetAt?: Date | null
}

// Tracks the spec thresholds against percent-used.
function fillClassFor(percent: number): string {
  if (percent >= 100) return 'bg-danger'
  if (percent >= 80) return 'bg-warning'
  return 'bg-site-accent'
}

function formatReset(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export function UsageMeter({ label, used, limit, unit, periodResetAt = null }: IUsageMeterProps) {
  const isUnlimited = limit === Number.POSITIVE_INFINITY
  // limit=0 means the quota does not apply to this plan; we render it as N/A.
  const isNotApplicable = limit === 0
  const unitSuffix = unit !== undefined && unit !== '' ? ` ${unit}` : ''

  const percent = isUnlimited || isNotApplicable ? 0 : Math.min(100, (used / limit) * 100)
  const clampedUsed = Math.max(0, used)

  return (
    <div className="border-site-border bg-site-surface rounded-2xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-site-text text-sm font-medium">{label}</span>
        <span className="text-site-muted text-xs tabular-nums">
          {isNotApplicable ? (
            '—'
          ) : isUnlimited ? (
            <>
              {clampedUsed.toLocaleString()}
              {unitSuffix} · unlimited
            </>
          ) : (
            <>
              {clampedUsed.toLocaleString()} / {limit.toLocaleString()}
              {unitSuffix}
            </>
          )}
        </span>
      </div>

      <div
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom-styled progress bar with fill div child; native <progress> cannot contain styled children
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={isUnlimited || isNotApplicable ? undefined : limit}
        aria-valuenow={isUnlimited || isNotApplicable ? undefined : clampedUsed}
        className="bg-site-raised mt-3 h-2 w-full overflow-hidden rounded-full"
      >
        {!isNotApplicable && (
          <div
            className={`h-full rounded-full transition-[width] ${
              isUnlimited ? 'bg-site-accent/40 w-full' : fillClassFor(percent)
            }`}
            style={isUnlimited ? undefined : { width: `${percent}%` }}
          />
        )}
      </div>

      {periodResetAt !== null && (
        <p className="text-site-faint mt-2 text-xs">Resets {formatReset(periodResetAt)}</p>
      )}
    </div>
  )
}
