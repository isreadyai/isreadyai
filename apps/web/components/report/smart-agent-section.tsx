'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { ISmartAgentReport } from '@isreadyai/scanner'
import { ScoreRing } from './score-ring'
import { notify } from '@/components/ui/toast'
import { VercelMark } from '@/components/ui/vercel-mark'
import { colorForScore } from '@/lib/grade'
import { smartCategoryFaqHref } from '@/lib/check-category-docs'
import { loadGsap } from '@/lib/load-gsap'
import { runReportEntrance } from '@/lib/report-entrance'
import { prefersReducedMotion } from '@/lib/motion'
import type { TSmartScanStatus } from '@/lib/scan-record'

interface ISmartAgentSectionProps {
  status: TSmartScanStatus
  report: ISmartAgentReport | null
  /** The site-wide deep smart pass is still running — hold the ring on SCORING…. */
  pending?: boolean
  /** A deep (site-wide) scan is in view — tag the section with a DEEP chip. */
  deep?: boolean
}

export function SmartAgentSection({
  status,
  report,
  pending = false,
  deep = false,
}: ISmartAgentSectionProps) {
  const t = useTranslations('report.smartAgent')
  const tReport = useTranslations('report')
  const cardRef = useRef<HTMLDivElement | null>(null)

  // The smart block lands after the main report, so it runs its own copy of the
  // report entrance — identical choreography, namespaced hooks (data-smart-anim).
  useLayoutEffect(() => {
    const scope = cardRef.current
    if (status !== 'done' || report === null || scope === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let ctx: { revert(): void } | undefined
    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      ctx = runReportEntrance(scope, gsap, 'data-smart-anim')
    })
    return () => {
      alive = false
      ctx?.revert()
    }
  }, [status, report])

  // Failures surface as a standard toast, not an inline box — but ONLY when the
  // pass fails live (queued/running → failed). Re-opening a past scan that never
  // got a Smart Agent result must stay silent, not re-toast the old failure.
  const wasPending = useRef(false)
  useEffect(() => {
    if (status === 'queued' || status === 'running') {
      wasPending.current = true
      return
    }
    if ((status === 'unavailable' || status === 'failed') && wasPending.current) {
      wasPending.current = false
      notify.warning(status === 'unavailable' ? t('unavailable') : t('failed'))
    }
  }, [status, t])

  // Owner turned the Smart Agent pass off for this site — hide the section.
  if (status === 'disabled') {
    return null
  }

  if (status === 'queued' || status === 'running') {
    return (
      <section aria-labelledby="smart-agent-title" className="mt-10">
        <Heading />
        <output className="mt-4 flex items-center gap-3">
          <span
            className="border-site-border border-t-site-secondary h-6 w-6 animate-spin rounded-full border-2"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium">{t('running')}</p>
            <p className="text-site-muted mt-1 text-xs">{t('runningHint')}</p>
          </div>
        </output>
      </section>
    )
  }

  if (status === 'unavailable' || status === 'failed' || report === null) {
    return (
      <section aria-labelledby="smart-agent-title" className="mt-10">
        <Heading />
        <Attribution />
      </section>
    )
  }

  return (
    <section aria-labelledby="smart-agent-title" className="mt-10">
      <Heading deep={deep} />
      <div
        ref={cardRef}
        data-smart-anim="panel"
        className="border-site-secondary/40 bg-site-surface/50 mt-4 rounded-2xl border p-5 sm:p-8"
      >
        <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
          <ScoreRing
            score={report.overall}
            grade={report.grade}
            label={pending ? tReport('scoring') : t(`grade.${report.grade}`)}
            loading={pending}
          />
          <div className="space-y-3">
            {report.categories.map((category) => (
              <div
                key={category.category}
                data-smart-anim="cat"
                className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-2 text-sm sm:grid-cols-[12rem_1fr_2.5rem]"
              >
                <a
                  href={smartCategoryFaqHref(category.category)}
                  className="text-site-muted hover:text-site-secondary col-start-1 row-start-1 min-w-0 truncate underline decoration-site-border underline-offset-4 transition-colors hover:decoration-site-secondary"
                  aria-label={tReport('categoryDetails', { category: category.label })}
                >
                  {category.label}
                </a>
                <div
                  className="bg-site-raised col-span-2 row-start-2 h-2 overflow-hidden rounded-full sm:col-span-1 sm:col-start-2 sm:row-start-1"
                  // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom-styled progress bar with fill div child; native <progress> cannot contain styled children
                  role="progressbar"
                  aria-valuenow={pending ? 0 : category.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={category.label}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${pending ? 0 : category.score}%`,
                      background: colorForScore(category.score),
                    }}
                  />
                </div>
                <span className="col-start-2 row-start-1 text-right font-mono text-xs sm:col-start-3">
                  {pending ? '' : category.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        <details className="border-site-border bg-site-background/50 group mt-7 hidden rounded-xl border sm:block">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-sm font-semibold">{t('viewTitle')}</span>
              <span className="text-site-muted mt-0.5 block text-xs">
                {deep ? t('viewHintDeep') : t('viewHint')}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-site-secondary transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          <pre className="border-site-border text-site-muted max-h-96 overflow-auto border-t p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {report.agentView.snapshot}
          </pre>
        </details>

        <Attribution />
      </div>
    </section>
  )
}

function Heading({ deep = false }: { deep?: boolean }) {
  const t = useTranslations('report.smartAgent')
  return (
    <div className="min-w-0">
      <h2 id="smart-agent-title" className="flex items-center gap-2 text-lg font-semibold">
        {t('title')}
        {deep ? <DeepChip /> : null}
      </h2>
      <p className="text-site-muted mt-1 text-sm">{t('description')}</p>
    </div>
  )
}

function DeepChip() {
  const t = useTranslations('report')
  return (
    <span className="text-site-accent border-site-accent/40 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase">
      {t('deepBadge')}
    </span>
  )
}

function Attribution() {
  const t = useTranslations('report.smartAgent')
  return (
    <p className="text-site-faint mt-5 flex flex-wrap items-center gap-1.5 text-xs">
      <VercelMark className="text-site-text" />
      <span>{t('poweredBy')}</span>
      <a
        href="https://agent-browser.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="text-site-text hover:text-site-secondary underline underline-offset-2"
      >
        agent-browser
      </a>
      <span>{t('vercelProject')}</span>
    </p>
  )
}
