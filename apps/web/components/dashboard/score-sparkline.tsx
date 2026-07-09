'use client'

// MARK: - Score trend chart (pure SVG, fills its container)
//
// Combined-score trend over the user's recent scans, oldest → newest, on a fixed
// 0–100 axis. The SVG stretches to the full card (preserveAspectRatio="none")
// with non-scaling strokes so lines stay crisp; axis/date labels and the end dot
// are HTML overlays positioned by percentage, so they never distort.

import { dayjs } from '@/lib/dayjs'
import { useBrowserTimeZone } from '@/lib/use-browser-time-zone'

export interface IScorePoint {
  score: number
  at: string
}

const GRID = [0, 50, 100]

function fmtDate(s: string, timeZone: string | null): string {
  return dayjs
    .utc(s)
    .tz(timeZone ?? 'UTC')
    .format('MMM D')
}

// Score (0–100) → SVG y (0 at top). Module-scoped — captures nothing.
function py(score: number): number {
  return (1 - score / 100) * 100
}

/** Score trend chart (pure SVG, fills container, no client JS). */
export function ScoreSparkline({ points }: { points: IScorePoint[] }) {
  const timeZone = useBrowserTimeZone()
  const first = points[0]
  const last = points[points.length - 1]
  if (points.length < 2 || first === undefined || last === undefined) {
    return null
  }
  const n = points.length
  // Inset x slightly so the first/last markers aren't clipped at the edges.
  const px = (i: number): number => 1.5 + (i / (n - 1)) * 97
  const coords = points.map((p, i) => [px(i), py(p.score)] as const)
  const line = coords
    .map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx.toFixed(2)} ${cy.toFixed(2)}`)
    .join(' ')
  const area = `${line} L${px(n - 1).toFixed(2)} 100 L${px(0).toFixed(2)} 100 Z`

  return (
    <div className="relative h-full min-h-32 w-full">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {GRID.map((score) => (
          <line
            key={score}
            x1="0"
            y1={py(score)}
            x2="100"
            y2={py(score)}
            stroke="var(--color-site-border)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {coords.map(([cx], i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: positional grid line
            // eslint-disable-next-line react/no-array-index-key -- positional grid lines, no stable id
            key={i}
            x1={cx}
            y1="0"
            x2={cx}
            y2="100"
            stroke="var(--color-site-border)"
            strokeWidth="1"
            opacity="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill="var(--color-site-accent)" opacity="0.1" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-site-accent)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {GRID.map((score) => (
        <span
          key={score}
          className="text-site-faint pointer-events-none absolute left-0.5 -translate-y-1/2 font-mono text-[10px]"
          style={{ top: `${py(score)}%` }}
        >
          {score}
        </span>
      ))}
      <span
        className="bg-site-accent pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${px(n - 1)}%`, top: `${py(last.score)}%` }}
      />
      <span className="text-site-faint pointer-events-none absolute bottom-0 left-0.5 font-mono text-[10px]">
        {fmtDate(first.at, timeZone)}
      </span>
      <span className="text-site-faint pointer-events-none absolute right-0.5 bottom-0 font-mono text-[10px]">
        {fmtDate(last.at, timeZone)}
      </span>
    </div>
  )
}
