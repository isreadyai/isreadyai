import type { TGrade } from '@isreadyai/scanner'
import { GRADE_COLORS } from '@/lib/grade'

// MARK: - Score ring (pure SVG, no client JS)

export function ScoreRing({
  score,
  grade,
  label,
  loading = false,
}: {
  score: number
  grade: TGrade
  label: string
  /** Holds an indeterminate ring until every executed track has settled. */
  loading?: boolean
}) {
  const radius = 64
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color = GRADE_COLORS[grade]

  if (loading) {
    return (
      <output className="flex flex-col items-center" aria-label={label}>
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          aria-hidden="true"
          className="animate-spin"
        >
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--color-site-raised)"
            strokeWidth="10"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--color-site-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <span className="text-site-muted mt-1 font-mono text-sm font-semibold tracking-widest uppercase">
          {label}
        </span>
      </output>
    )
  }

  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- wraps SVG children; <img> is self-closing and cannot contain them
    <div className="flex flex-col items-center" role="img" aria-label={`${score}/100 — ${label}`}>
      <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="var(--color-site-raised)"
          strokeWidth="10"
        />
        <circle
          data-ring="progress"
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform="rotate(-90 80 80)"
        />
        <text
          data-score-number={score}
          x="80"
          y="82"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-site-text)"
          fontSize="40"
          fontWeight="700"
          fontFamily="var(--font-mono)"
        >
          {score}
        </text>
        <text
          x="80"
          y="112"
          textAnchor="middle"
          fill="var(--color-site-muted)"
          fontSize="12"
          fontFamily="var(--font-mono)"
        >
          / 100
        </text>
      </svg>
      <span
        className="mt-1 font-mono text-sm font-semibold tracking-widest uppercase"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  )
}
