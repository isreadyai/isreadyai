'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { IScanReport, ISiteReport } from '@isreadyai/scanner'
import { runDeepScan, deepScanLimit } from '@/lib/deep-scan'
import { goToEmailCapture } from '@/lib/email-capture'
import { textForScore } from '@/lib/grade'
import { Button } from '@/components/ui/button'
import { notify } from '@/components/ui/toast'
import type { TScanRunPhase } from '@/lib/scan-record'
import { DeepClusterCard } from './deep-cluster-card'

const DEEP_PAGE_CAP = 10

// MARK: - Deep scan (free, runs in the visitor's browser)

/**
 * Crawls sitemap + homepage links and runs page-scope checks on each, client-
 * side with fetches relayed through /api/proxy. Result lifts to ReportView,
 * which promotes the whole report to the site-wide view.
 */

export function DeepScanSection({
  url,
  primary,
  site,
  onDone,
  autoStart = false,
  authenticated = false,
  premium = false,
  readOnly = false,
  shared = false,
  proxyToken = '',
  onSettle,
  onProgress,
  embedded = false,
  active = true,
}: {
  url: string
  /** The server's primary report — reused so the deep scan only fetches NEW pages. */
  primary: IScanReport
  site: ISiteReport | null
  onDone: (site: ISiteReport) => void
  /** Arriving with ?deep=true (e.g. "Deep scan" from the dashboard) kicks it off. */
  autoStart?: boolean
  /** Signed-in users never see the sign-up upsell. */
  authenticated?: boolean
  /** Premium runs the full, uncapped crawl; non-premium is capped at deepScanLimit(). */
  premium?: boolean
  /** Past scan: hide the run CTA — re-crawling would mutate the saved record. */
  readOnly?: boolean
  /** Shared link (scan has a registered owner): hide the sign-up full-scan upsell. */
  shared?: boolean
  /** Host-bound HMAC token issued by the server; forwarded to /api/proxy on every fetch. */
  proxyToken?: string
  /** Fires when a run finishes (success or failure) so the score can settle. */
  onSettle?: () => void
  /** Called with each progress message so the parent can mirror the live string. */
  onProgress?: (message: string) => void
  /** Render as a tab body (no section/heading) inside the unified Deep scan block. */
  embedded?: boolean
  /** When embedded, hidden unless this is the active tab (stays mounted to auto-run). */
  active?: boolean
}) {
  const t = useTranslations('report')

  const [phase, setPhase] = useState<TScanRunPhase>('idle')
  const [progress, setProgress] = useState('')
  // filter/showAll are only used by the flat fallback path (pre-cluster reports).
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const started = useRef(false)

  async function start(): Promise<void> {
    setPhase('running')
    try {
      const result = await runDeepScan(
        url,
        primary,
        (msg) => {
          setProgress(msg)
          onProgress?.(msg)
        },
        premium ? Infinity : deepScanLimit(),
        proxyToken,
      )
      onDone(result)
      setPhase('idle')
    } catch {
      setPhase('failed')
      notify.warning(t('deepFailed'))
    } finally {
      onSettle?.()
    }
  }

  // Fire once when asked to auto-start and no deep result exists yet.
  useEffect(() => {
    if (autoStart && site === null && !started.current) {
      started.current = true
      void start()
    }
    // start/url/primary are stable for a given report; deps kept minimal on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, site])

  const pages = site === null ? [] : [site.primary, ...site.pages]

  const clusters = site?.clusters ?? []
  const useClusters = site !== null && clusters.length > 0

  // Page-by-url lookup — used to build the memberScore callback for DeepClusterCard
  // and to render the flat fallback list.
  const pageByUrl = new Map(pages.map((p) => [p.finalUrl, p]))

  // Sum of scannedCount across all clusters; passed as the "scanned" header count.
  const totalScanned = clusters.reduce((sum, c) => sum + c.scannedCount, 0)

  // Flat fallback derived values (pre-cluster reports only).
  const query = filter.trim().toLowerCase()
  const visiblePages =
    query === '' ? pages : pages.filter((p) => p.finalUrl.toLowerCase().includes(query))
  const showCapToggle = visiblePages.length > DEEP_PAGE_CAP
  const listedPages = !showAll ? visiblePages.slice(0, DEEP_PAGE_CAP) : visiblePages

  const content = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {embedded ? null : <h2 className="text-lg font-semibold">{t('deepTitle')}</h2>}
          <p className={`text-site-muted text-sm ${embedded ? '' : 'mt-1'}`}>
            {premium || (site !== null && site.pages.length > deepScanLimit())
              ? t('deepHintPremium')
              : t('deepHint', { limit: deepScanLimit() })}
          </p>
        </div>
        {site === null && phase !== 'running' && !readOnly ? (
          <Button variant="primary" onPress={() => void start()} className="shrink-0">
            {t('deepCta')}
          </Button>
        ) : null}
      </div>

      {phase === 'running' ? (
        <output className="mt-4 flex items-center gap-3">
          <div
            className="border-site-border border-t-site-accent h-5 w-5 animate-spin rounded-full border-2"
            aria-hidden="true"
          />
          <p className="text-site-muted truncate font-mono text-xs">{progress}</p>
        </output>
      ) : null}

      {site !== null ? (
        <>
          {useClusters ? (
            <DeepClusterCard
              clusters={clusters}
              found={site.discovered}
              scanned={totalScanned}
              memberScore={(memberUrl) => {
                const page = pageByUrl.get(memberUrl)
                if (page === undefined) return undefined
                return {
                  overall: page.overall,
                  failCount: page.checks.filter((c) => c.status === 'fail').length,
                }
              }}
            />
          ) : (
            // Flat fallback for pre-cluster reports (no ISiteCluster data).
            <div className="border-site-border bg-site-surface/50 mt-4 rounded-2xl border p-4 sm:p-5">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-site-muted min-w-0 text-sm sm:truncate">
                  {t('deepSummary', { scanned: pages.length, discovered: site.discovered })}
                </span>
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.currentTarget.value)}
                  placeholder={t('deepSearchPlaceholder')}
                  aria-label={t('deepSearchPlaceholder')}
                  className="border-site-border bg-site-background focus:border-site-accent w-full min-w-0 rounded-lg border px-2.5 py-2 font-mono text-xs outline-none transition-colors sm:w-52 sm:shrink-0 sm:py-1"
                />
              </div>
              <div>
                <ul className="mt-3 space-y-1.5">
                  {listedPages.map((page) => {
                    const failed = page.checks.filter((c) => c.status === 'fail').length
                    return (
                      <li key={page.finalUrl} className="flex items-center gap-3 font-mono text-xs">
                        <span
                          className={`${textForScore(page.overall)} w-8 text-right font-semibold`}
                        >
                          {page.overall}
                        </span>
                        <span className="bg-site-raised h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                          <span
                            className={`${textForScore(page.overall)} block h-full rounded-full bg-current`}
                            style={{ width: `${page.overall}%` }}
                          />
                        </span>
                        <span className="text-site-muted min-w-0 truncate">
                          {pathOf(page.finalUrl)}
                        </span>
                        {failed > 0 ? (
                          <span className="text-score-poor ml-auto shrink-0">✗ {failed}</span>
                        ) : (
                          <span className="text-score-excellent ml-auto shrink-0">✓</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {showCapToggle ? (
                  <button
                    type="button"
                    onClick={() => setShowAll((value) => !value)}
                    aria-expanded={showAll}
                    aria-label={showAll ? t('deepShowLess') : t('deepShowAll')}
                    className="text-site-muted hover:text-site-accent mx-auto mt-3 flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors"
                  >
                    <DoubleCaretIcon className={showAll ? 'rotate-180' : ''} />
                  </button>
                ) : null}
              </div>
            </div>
          )}
          {!authenticated && !shared && site.discovered > site.pages.length ? (
            <output className="border-site-accent/40 bg-site-accent/10 mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {t('deepPartial', {
                  discovered: site.discovered,
                  scanned: site.pages.length,
                })}
              </p>
              <Button
                variant="primary"
                onPress={goToEmailCapture}
                className="min-h-10 shrink-0 px-4 text-xs"
              >
                {t('deepSignupCta')}
              </Button>
            </output>
          ) : null}
        </>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className={active ? 'mt-4' : 'hidden'}>{content}</div>
  }
  return (
    <section data-anim="panel" aria-label={t('deepTitle')} className="mt-10">
      {content}
    </section>
  )
}

function DoubleCaretIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 transition-transform ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 3.5l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 8.5l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname === '/' ? parsed.host : `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}
