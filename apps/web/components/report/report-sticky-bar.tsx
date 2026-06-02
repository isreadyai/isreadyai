'use client'

import type { IScanReport, ISiteReport } from '@isreadyai/scanner'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { gradeOf } from '@isreadyai/scanner'
import { prefersReducedMotion, scrollToTop } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'
import { GRADE_COLORS } from '@/lib/grade'
import { hostOf } from '@/lib/url'
import { HEADER_BAR_SLOT_ID } from '@/components/site-header'

// MARK: - Compact report row (inside the header pill)

/**
 * Portals a second row into the floating header pill so it shares the pill's
 * glass surface and radius and stays attached on every breakpoint. Grows down
 * once the score panel scrolls past, slides closed when it returns. Reduced
 * motion: instant toggle.
 */

export function ReportStickyBar({
  report,
  site,
  score,
  watchSelector,
}: {
  report: IScanReport
  /** Deep-scan result: when present the bar shows the site-wide values. */
  site?: ISiteReport | null
  /** Combined headline score; overrides the report/site value when provided. */
  score?: number
  watchSelector: string
}) {
  const t = useTranslations('report')

  // MARK: - Variables
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // MARK: - Lifecycle
  useEffect(() => {
    setSlot(document.getElementById(HEADER_BAR_SLOT_ID))
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const panel = document.querySelector(watchSelector)
    if (slot === null || wrap === null || panel === null) {
      return
    }
    let alive = true
    let trigger: { kill(): void } | undefined

    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (!alive) {
        return
      }
      const reduced = prefersReducedMotion()
      const show = (): void => {
        if (reduced) {
          gsap.set(wrap, { height: 'auto', autoAlpha: 1 })
        } else {
          gsap.to(wrap, { height: 'auto', autoAlpha: 1, duration: 0.45, ease: 'power3.out' })
        }
      }
      const hide = (): void => {
        if (reduced) {
          gsap.set(wrap, { height: 0, autoAlpha: 0 })
        } else {
          gsap.to(wrap, { height: 0, autoAlpha: 0, duration: 0.35, ease: 'power3.in' })
        }
      }

      gsap.set(wrap, { height: 0, autoAlpha: 0 })
      trigger = ScrollTrigger.create({
        trigger: panel,
        start: 'bottom top+=64',
        onEnter: show,
        onLeaveBack: hide,
      })
    })
    return () => {
      alive = false
      trigger?.kill()
    }
  }, [slot, watchSelector])

  if (slot === null) {
    return null
  }

  const allPages = site === null || site === undefined ? [report] : [site.primary, ...site.pages]
  const overall = score ?? site?.overall ?? report.overall
  // Match the main ring: grade from the shown score, not a (possibly stale) field.
  const grade = gradeOf(overall)
  const failed = allPages.flatMap((p) => p.checks).filter((c) => c.status === 'fail').length
  const warned = allPages.flatMap((p) => p.checks).filter((c) => c.status === 'warn').length
  const color = GRADE_COLORS[grade]
  const radius = 13
  const circumference = 2 * Math.PI * radius
  const filled = (overall / 100) * circumference

  const missing =
    failed === 0 && warned === 0
      ? t('noFindings')
      : `${failed} ${t('failedCount')} · ${warned} ${t('warnings')}`

  return createPortal(
    <div ref={wrapRef} className="h-0 overflow-hidden opacity-0">
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t('backToFullReport')}
        className="border-site-border/60 hover:bg-site-surface/40 block w-full cursor-pointer border-t text-left transition-colors"
      >
        <div aria-hidden="true" className="flex h-12 items-center gap-3 px-4 sm:px-6">
          <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0">
            <circle
              cx="17"
              cy="17"
              r={radius}
              fill="none"
              stroke="var(--color-site-raised)"
              strokeWidth="3"
            />
            <circle
              cx="17"
              cy="17"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
              transform="rotate(-90 17 17)"
            />
            <text
              x="17"
              y="21"
              textAnchor="middle"
              fill="var(--color-site-text)"
              fontSize="11"
              fontWeight="700"
              fontFamily="var(--font-mono)"
            >
              {overall}
            </text>
          </svg>
          <span
            className="font-mono text-sm font-semibold tracking-widest uppercase"
            style={{ color }}
          >
            {t(`grade.${grade}`)}
          </span>
          <span className="text-site-muted hidden truncate text-sm md:block">{missing}</span>
          <span className="text-site-faint ml-auto shrink-0 truncate font-mono text-xs">
            {hostOf(report.finalUrl)}
          </span>
        </div>
      </button>
    </div>,
    slot,
  )
}
