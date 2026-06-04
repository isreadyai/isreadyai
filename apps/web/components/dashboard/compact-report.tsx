'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { gradeOf } from '@isreadyai/scanner'
import { GRADE_COLORS } from '@/lib/grade'

// MARK: - Compact report

export interface ICompactReport {
  overall: number | null
  failed: number
  warned: number
  isDeep: boolean
  isSmart: boolean
  emptyLabel: string
}

/** Renders mini progress ring, grade badge, and AI capability chips for scan reports. */
export function CompactReport({ data }: { data: ICompactReport }) {
  const tr = useTranslations('report')
  const td = useTranslations('dashboard')

  if (data.overall === null) {
    return (
      <span className="text-site-muted text-xs tracking-wide uppercase">{data.emptyLabel}</span>
    )
  }

  const grade = gradeOf(data.overall)
  const color = GRADE_COLORS[grade]
  const radius = 11
  const circumference = 2 * Math.PI * radius
  const filled = (data.overall / 100) * circumference
  const summary =
    data.failed === 0 && data.warned === 0
      ? tr('noFindings')
      : td('scanFindings', { failed: data.failed, warned: data.warned })

  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 30 30" className="shrink-0" aria-hidden="true">
        <circle
          cx="15"
          cy="15"
          r={radius}
          fill="none"
          stroke="var(--color-site-raised)"
          strokeWidth="3"
        />
        <circle
          cx="15"
          cy="15"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform="rotate(-90 15 15)"
        />
        <text
          x="15"
          y="18.5"
          textAnchor="middle"
          fill="var(--color-site-text)"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fontWeight="700"
        >
          {data.overall}
        </text>
      </svg>
      <span className="font-mono text-xs font-semibold tracking-widest uppercase" style={{ color }}>
        {tr(`grade.${grade}`)}
      </span>
      {data.isDeep ? (
        <ReportChip label={td('deepBadge')} tip={td('deepBadgeTip')} tone="primary" />
      ) : null}
      {data.isSmart ? (
        <ReportChip label={td('smartBadge')} tip={td('smartBadgeTip')} tone="secondary" />
      ) : null}
      <span className="text-site-muted hidden truncate text-xs sm:block">{summary}</span>
    </div>
  )
}

/** Renders a capability badge (DEEP or SMART) with hover tooltip. */
function ReportChip({
  label,
  tip,
  tone,
}: {
  label: string
  tip: string
  tone: 'primary' | 'secondary'
}) {
  const toneCls =
    tone === 'primary'
      ? 'border-site-accent/45 text-site-accent'
      : 'border-site-secondary/45 text-site-secondary'
  const ref = useRef<HTMLSpanElement>(null)
  // Portal-anchored coords: a fixed-position tooltip escapes the table's
  // overflow clipping (and stacking context) so it never gets truncated.
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)

  function show(): void {
    const rect = ref.current?.getBoundingClientRect()
    if (rect !== undefined) {
      setCoords({ x: rect.left + rect.width / 2, y: rect.top })
    }
  }

  return (
    <span
      ref={ref}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- intentional: tooltip trigger must be keyboard-focusable for accessibility
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setCoords(null)}
      onFocus={show}
      onBlur={() => setCoords(null)}
      className={`shrink-0 cursor-help rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase outline-none ${toneCls}`}
    >
      {label}
      {coords !== null && typeof document !== 'undefined'
        ? createPortal(
            <span
              role="tooltip"
              style={{ left: coords.x, top: coords.y - 8 }}
              className="border-site-border bg-site-raised text-site-text pointer-events-none fixed z-[100] w-56 -translate-x-1/2 -translate-y-full rounded-lg border p-2 text-[11px] leading-snug font-normal tracking-normal normal-case shadow-lg"
            >
              {tip}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
