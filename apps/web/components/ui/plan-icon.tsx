import type { TPlan } from '@/lib/plans'
import { EPlan } from '@/lib/plans'

// MARK: - PlanIcon (Free / Pro / Team)

/**
 * Renders a plan icon (Free / Pro / Team) as an inline SVG.
 * Avoids bundling a multi-megabyte icon font; Free = sprout, Pro = lightning, Team = people.
 */
export function PlanIcon({ plan, className = 'size-4' }: { plan: TPlan; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (plan) {
    case EPlan.FREE:
      return (
        <svg {...common}>
          <path d="M12 21v-7" />
          <path d="M12 14c-3.6 0-6-2.5-6-6 3.6 0 6 2.5 6 6Z" />
          <path d="M12 11.5c0-3 2.2-5 5-5 0 2.8-2 5-5 5Z" />
        </svg>
      )
    case EPlan.PRO:
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      )
    case EPlan.TEAM:
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.5a5.5 5.5 0 0 1 3 5.5" />
        </svg>
      )
    default:
      return null
  }
}
