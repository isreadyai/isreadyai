'use client'

import type {
  ICheckResult,
  ISiteReport,
  ISmartAgentSignal,
  ISmartAgentSiteReport,
} from '@isreadyai/scanner'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { aggregateSiteFindings, ECategory, gradeOf } from '@isreadyai/scanner'
import { aiSearchScore, combinedScore, deepTrackScore, smartTrackScore } from '@/lib/score'
import { deepScanLimit } from '@/lib/deep-scan'
import { recallScanWriteToken, rememberScanWriteToken } from '@/lib/scan-write-token-client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { prefersReducedMotion } from '@/lib/motion'
import { badgeDataUrl } from '@/lib/badge-svg'
import { loadGsap } from '@/lib/load-gsap'
import { runReportEntrance } from '@/lib/report-entrance'
import { hostOf } from '@/lib/url'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { EmailReportForm } from './email-report-form'
import { ReportDownloads } from './report-downloads'
import { Button, EButtonAppearance, EButtonVariant } from '@/components/ui/button'
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ScoreRing } from './score-ring'
import { AiSearchBar, SmartAgentBar } from './category-bar'
import { FindingItem } from './finding-item'
import { ReportStickyBar } from './report-sticky-bar'
import { DeepScanSection } from './deep-scan-section'
import { SmartAgentDeepSection } from './smart-agent-deep-section'
import { PremiumTiers, type ITierPrices } from '@/components/premium-tiers'
import { dayjs } from '@/lib/dayjs'
import { AiSearchSection } from './ai-search-section'
import { SmartAgentSection } from './smart-agent-section'
import { SolutionSection } from './solution-section'
import { AskYourSite } from './ask-your-site'
import { useScanRecord } from './use-scan-record'
import { useBrowserTimeZone } from '@/lib/use-browser-time-zone'

// MARK: - Report view (polls until the scan settles)

export function ReportView({
  id,
  context = 'public',
  premium = false,
  prices = null,
  websiteId,
  shared = false,
  proxyToken = '',
}: {
  id: string
  context?: 'public' | 'dashboard'
  premium?: boolean
  /** Localised plan prices for the public report's pricing table. */
  prices?: ITierPrices | null
  /**
   * Set when this scan's host is a tracked website owned by the viewer: the
   * Ask-your-site chat then scopes to the website (one shared thread) instead of
   * this one scan. Resolved server-side by the page rendering this view.
   */
  websiteId?: string
  /**
   * This scan has a registered owner — a shared link the viewer didn't run. Hide
   * the owner-only Save and full-scan upsells; the report itself stays complete.
   */
  shared?: boolean
  /** Host-bound HMAC token issued server-side; forwarded to /api/proxy by the deep-scan crawler. */
  proxyToken?: string
}) {
  const t = useTranslations('report')
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDashboard = context === 'dashboard'

  // MARK: - Variables
  const { record, missing, errored, done } = useScanRecord(id)
  const timeZone = useBrowserTimeZone()
  const [rescanning, setRescanning] = useState(false)
  const deleteConfirm = useConfirm()
  const [deleting, setDeleting] = useState(false)
  const { copied, copy } = useCopyToClipboard(2000)
  const [anyOpen, setAnyOpen] = useState(false)
  // Deep-scan result: when set, the whole report goes site-wide.
  const [site, setSite] = useState<ISiteReport | null>(null)
  // Smart Agent — Deep scan result, lifted so it feeds the combined score.
  const [siteSmart, setSiteSmart] = useState<ISmartAgentSiteReport | null>(null)
  // Live progress message from the deep-crawl pass (e.g. "Scanning page 3/42: /about").
  // Null before the first message arrives and after the crawl settles.
  const [deepProgress, setDeepProgress] = useState<string | null>(null)
  // Settle flags for the two client-driven passes (deep crawl, smart deep): the
  // top score holds until every executed track reports back, success or not.
  const [deepRan, setDeepRan] = useState(false)
  const [smartDeepRan, setSmartDeepRan] = useState(false)
  const [deepView, setDeepView] = useState<'standard' | 'smart'>('standard')
  const articleRef = useRef<HTMLElement>(null)
  const findingsRef = useRef<HTMLDivElement>(null)

  // MARK: - Methods
  async function rescan(url: string): Promise<void> {
    setRescanning(true)
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!response.ok) {
        setRescanning(false)
        return
      }
      const data = (await response.json()) as { id: string; writeToken?: string }
      if (data.writeToken !== undefined) {
        rememberScanWriteToken(data.id, data.writeToken)
      }
      // Re-run in the same mode: a deep report re-runs deep (?deep=true auto-starts
      // the crawl on the new scan); a single-page report stays single-page.
      const base = isDashboard ? `/dashboard/scans/${data.id}` : `/report/${data.id}`
      const deepIntent = site !== null || searchParams.get('deep') === 'true'
      router.push(deepIntent ? `${base}?deep=true` : base)
    } catch {
      setRescanning(false)
    }
  }

  async function deleteScan(): Promise<void> {
    setDeleting(true)
    try {
      const response = await fetch(`/api/scan/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setDeleting(false)
        return
      }
      router.push('/dashboard/scans')
    } catch {
      setDeleting(false)
    }
  }

  async function share(): Promise<void> {
    // Always hand out the public, capability-by-id report URL — never
    // window.location.href, which on the dashboard is the auth-gated owner URL
    // that bounces a recipient to login. /report/[id] reads the scan via the
    // service client (public-by-id) and renders the shared, read-only view.
    const url = `${window.location.origin}/report/${id}`
    // Native share sheet where available; clipboard otherwise.
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: document.title, url }).catch(() => undefined)
      return
    }
    await copy(url)
  }

  const persistDeep = useCallback(
    (result: ISiteReport): void => {
      setSite(result)
      // Gzip-compress the payload before sending so large deep scans (1 000+ pages
      // → 20-50 MB raw JSON) stay under the server's 4 MB body cap.  The UI shows
      // the result immediately (setSite above); this fire-and-forget only handles
      // persistence so the deep result survives a reload.
      void (async () => {
        try {
          const bodyStr = JSON.stringify({ siteReport: result })
          // Blob.stream().pipeThrough() drives both sides of the CompressionStream
          // concurrently via the pipe mechanism — no backpressure deadlock.
          const compressed = await new Response(
            new Blob([bodyStr]).stream().pipeThrough(new CompressionStream('gzip')),
          ).arrayBuffer()
          const writeToken = recallScanWriteToken(id)
          await fetch(`/api/scan/${id}`, {
            method: 'PATCH',
            headers: {
              'content-type': 'application/json',
              'x-content-encoding': 'gzip',
              ...(writeToken !== null ? { 'x-scan-write-token': writeToken } : {}),
            },
            body: compressed,
          })
        } catch {
          // Persist is fire-and-forget; a failure is non-fatal (result already shown).
        }
      })()
      // Mark the URL as deep WITHOUT a Next navigation — router.replace re-fetches
      // the server component and flashes the whole view. The result is already
      // shown (setSite) and persisted (PATCH), and restored from the row on reload.
      if (typeof window !== 'undefined' && !window.location.search.includes('deep=true')) {
        const url = new URL(window.location.href)
        url.searchParams.set('deep', 'true')
        window.history.replaceState(window.history.state, '', url)
      }
    },
    [id],
  )

  function toggleAllFindings(): void {
    const open = !anyOpen
    findingsRef.current?.querySelectorAll('details').forEach((details) => (details.open = open))
    setAnyOpen(open)
  }

  // Restore a persisted deep scan on load so a past scan reflects it (no ?deep=true
  // needed): if the row carries a siteReport, the report opens site-wide.
  useEffect(() => {
    if (record?.siteReport && site === null) {
      setSite(record.siteReport)
    }
  }, [record, site])

  useEffect(() => {
    if (record?.siteSmartReport && siteSmart === null) {
      setSiteSmart(record.siteSmartReport)
    }
  }, [record, siteSmart])

  // MARK: - Lifecycle

  // 'toggle' doesn't bubble, so capture it to track manual opens.
  useEffect(() => {
    const container = findingsRef.current
    if (!done || container === null) {
      return
    }
    const sync = (): void => {
      setAnyOpen(container.querySelector('details[open]') !== null)
    }
    container.addEventListener('toggle', sync, true)
    return () => {
      container.removeEventListener('toggle', sync, true)
    }
  }, [done])

  useLayoutEffect(() => {
    const scope = articleRef.current
    if (!done || scope === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let ctx: { revert(): void } | undefined
    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      ctx = runReportEntrance(scope, gsap)
    })
    return () => {
      alive = false
      ctx?.revert()
    }
  }, [done])

  // MARK: - States
  if (missing) {
    return <EmptyState title={t('notFound')} hint={t('notFoundHint')} ctaLabel={t('scanAnother')} />
  }
  // A persistent fetch error (server down, repeated 5xx) — surface it instead of
  // spinning forever; the CTA goes home so the visitor can retry a fresh scan.
  if (errored) {
    return (
      <EmptyState title={t('loadError')} hint={t('loadErrorHint')} ctaLabel={t('scanAnother')} />
    )
  }
  // Still fetching the row — a READ of an existing scan, never a re-run. Shown
  // with neutral "loading" copy so opening a past scan doesn't look like a rescan.
  if (record === null) {
    return (
      <div
        className="flex flex-col items-center py-24 text-center"
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- structural container wrapping h1; <output> is phrasing content and would produce invalid HTML
        role="status"
      >
        <div
          className="border-site-border border-t-site-accent h-12 w-12 animate-spin rounded-full border-4"
          aria-hidden="true"
        />
        <h1 className="mt-6 text-xl font-semibold">{t('loadingReport')}</h1>
      </div>
    )
  }
  // Genuinely in progress — only true for a live scan still running server-side.
  // Show the report skeleton instead of a blocking full-page spinner so the user
  // sees the layout filling in as data arrives.
  if (record.status === 'queued' || record.status === 'running') {
    const skeletonGrade = gradeOf(0)
    return (
      <article aria-busy="true">
        <header className="flex flex-col">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                {t('title')}
              </h1>
              <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-sm">
                <span className="text-site-text">{hostOf(record.url)}</span>
                <span className="text-site-accent text-xs break-all" title={t('reportIdLabel')}>
                  {id}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {isDashboard ? (
                <Button
                  variant={EButtonVariant.DANGER}
                  appearance={EButtonAppearance.OUTLINE}
                  onPress={deleteConfirm.show}
                  ariaLabel={t('deleteScan')}
                  isDisabled
                  className="px-3.5"
                >
                  <TrashIcon />
                </Button>
              ) : (
                <span className="hidden sm:contents">
                  <Button
                    variant={EButtonVariant.NEUTRAL}
                    appearance={EButtonAppearance.OUTLINE}
                    href="/"
                  >
                    {t('scanAnother')}
                  </Button>
                </span>
              )}
              <Button
                variant={EButtonVariant.NEUTRAL}
                appearance={EButtonAppearance.OUTLINE}
                isDisabled
                ariaLabel={t('rescan')}
                className="px-3.5"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  className="animate-spin"
                >
                  <polyline
                    points="23 4 23 10 17 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
              <Button variant="primary" onPress={() => void share()} isDisabled>
                <ShareIcon />
                {copied !== null ? t('shared') : t('share')}
              </Button>
            </div>
          </div>
          <output className="text-site-muted mt-1.5 flex min-w-0 items-center gap-1.5 font-mono text-xs">
            <span
              className="border-site-border border-t-site-accent h-3 w-3 animate-spin rounded-full border-2 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">
              {t('scanning')} {hostOf(record.url)}…
            </span>
          </output>
        </header>

        <section
          id="score-panel"
          aria-label={t('overall')}
          className="border-site-border bg-site-surface/50 mt-8 grid items-center gap-8 rounded-2xl border p-5 sm:grid-cols-[auto_1fr] sm:p-8"
        >
          <ScoreRing score={0} grade={skeletonGrade} label={t('scoring')} loading={true} />
          <div className="@container space-y-3">
            <AiSearchBar score={0} pending={true} />
            <SmartAgentBar score={0} pending={true} />
            <div className="space-y-1.5 pt-1">
              <div className="bg-site-raised h-3 w-3/4 animate-pulse rounded" />
              <div className="bg-site-raised h-3 w-1/2 animate-pulse rounded" />
            </div>
          </div>
        </section>

        <section aria-label={t('findings')} className="mt-10">
          <h2 className="text-lg font-semibold">{t('findings')}</h2>
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-site-raised h-14 animate-pulse rounded-lg" />
            ))}
          </div>
        </section>

        {isDashboard ? (
          <ConfirmDialog
            open={deleteConfirm.open}
            onOpenChange={deleteConfirm.setOpen}
            title={t('deleteConfirmTitle')}
            description={t('deleteConfirmBody', { host: hostOf(record.url) })}
            confirmLabel={t('deleteConfirmCta')}
            cancelLabel={t('deleteCancel')}
            destructive
            pending={deleting}
            onConfirm={() => void deleteScan()}
          />
        ) : null}
      </article>
    )
  }
  if (record.status === 'failed' || record.report === null) {
    return <EmptyState title={t('failed')} hint={t('failedHint')} ctaLabel={t('scanAnother')} />
  }

  // MARK: - Report
  const report = record.report
  const allPages = site === null ? [report] : [site.primary, ...site.pages]
  const failing = report.checks.filter((c) => c.status === 'fail')
  const warning = report.checks.filter((c) => c.status === 'warn')
  // Smart Agent signals render in the SAME findings list, via the SAME FindingItem
  // component — failing first, then warnings.
  const smartFindings: ICheckResult[] = (record.smartReport?.signals ?? [])
    .filter((s) => s.status !== 'pass')
    .toSorted((a, b) => (a.status === b.status ? 0 : a.status === 'fail' ? -1 : 1))
    .map(smartSignalToCheck)
  // Counters across every scanned page once a deep scan ran.
  const passed = allPages.flatMap((p) => p.checks).filter((c) => c.status === 'pass').length
  const failedCount = allPages.flatMap((p) => p.checks).filter((c) => c.status === 'fail').length
  const warnedCount = allPages.flatMap((p) => p.checks).filter((c) => c.status === 'warn').length
  // Headline = equal-weight mean of the tracks that ran (base + deep + smart).
  const deepScore = deepTrackScore(site)
  const smartScore = smartTrackScore(record.smartReport, siteSmart)
  const overall = combinedScore({ base: report.overall, deep: deepScore, smart: smartScore })
  // Derive the grade from the SHOWN score so the ring/label colour always matches.
  const grade = gradeOf(overall)
  const categories = site?.categories ?? report.categories

  // A persisted dashboard scan opened from history is read-only: running deep /
  // smart-deep would mutate the saved record. The fresh-scan flow arrives with
  // ?deep=true, which keeps the auto-run and CTAs live.
  const readOnly = isDashboard && searchParams.get('deep') !== 'true'
  // Deep-scan default by tier: non-premium always gets the (capped) deep scan
  // automatically; premium stays basic until they press Deep scan (?deep=true),
  // which then runs the full uncapped crawl. Past saved scans stay read-only.
  // A shared report never auto-runs — the auto-start effect ignores readOnly, so
  // the run is gated here too, lest a viewer's crawl PATCH the owner's scan.
  const deepAutoStart =
    (!premium || searchParams.get('deep') === 'true') &&
    record.siteReport === null &&
    !readOnly &&
    !shared
  // Hold the headline until every executed track settles. Smart status carries
  // its own terminal states; the two client passes report back via settle flags.
  const smartPending = record.smartStatus === 'queued' || record.smartStatus === 'running'
  const deepPending = deepAutoStart && site === null && !deepRan
  const wantsDeep = deepAutoStart || site !== null || record.siteReport !== null
  // Smart Agent — Deep scan is a premium pass; only premium holds the score for it.
  // A read-only historical scan runs NO client passes (reads only), so it must never
  // wait on a smart-deep that won't fire — otherwise the score loops on "scoring…".
  const smartDeepPending =
    !readOnly &&
    premium &&
    wantsDeep &&
    record.smartStatus === 'done' &&
    siteSmart === null &&
    !smartDeepRan
  const scoringPending = smartPending || deepPending || smartDeepPending
  // Reserve the Smart-agent head row whenever the pass is live or done, so the
  // bar holds its place (empty while scoring) instead of popping in when the
  // score lands. Hidden only when the pass is genuinely off.
  const showSmartHeadBar =
    record.smartStatus === 'queued' ||
    record.smartStatus === 'running' ||
    record.smartStatus === 'done'
  // Hide the deep / smart-deep sections on past scans that never ran them — they'd
  // otherwise show an empty, action-less shell. Keep them on live (non-read-only)
  // scans (the run CTA) and whenever a result exists to display.
  const showDeepScan = site !== null || !readOnly
  const showSmartDeepScan =
    site !== null && ((record.siteSmartReport ?? null) !== null || !readOnly)
  const siteFindings = site === null ? [] : aggregateSiteFindings(site)
  const hasFindings =
    (site === null ? failing.length + warning.length : siteFindings.length) + smartFindings.length >
    0
  // Weight-0 signals (llms.txt, Content Signals…): reported, never scored.
  const infoChecks = report.checks.filter((c) => c.status === 'info')

  return (
    <article ref={articleRef}>
      <ReportStickyBar report={report} site={site} score={overall} watchSelector="#score-panel" />
      <header data-anim="panel" className="flex flex-col">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {t('title')}
              {site !== null ? (
                <span className="text-site-accent border-site-accent/40 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase">
                  {t('deepBadge')}
                </span>
              ) : null}
            </h1>
            <p className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-2 font-mono text-sm">
              <a
                href={report.finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-site-text hover:text-site-accent min-w-0 max-w-full break-all hover:underline"
                aria-label={`${report.finalUrl} (opens in a new tab)`}
              >
                {site === null ? report.finalUrl : wildcardUrl(report.finalUrl)}
              </a>
              <span className="text-site-accent text-xs break-all" title={t('reportIdLabel')}>
                {id}
              </span>
            </p>
            {!deepPending ? (
              <p className="text-site-muted mt-1.5 font-mono text-xs">
                {t('scannedAt', {
                  date: dayjs
                    .utc(record.createdAt)
                    .tz(timeZone ?? 'UTC')
                    .format('DD/MM/YYYY, HH:mm:ss'),
                })}
              </p>
            ) : null}
            {!premium ? (
              <p className="text-site-faint mt-1 text-xs">
                {t('scannedDeepFree', { limit: deepScanLimit() })}{' '}
                <Link
                  href="/pricing"
                  className="text-site-accent underline-offset-2 hover:underline"
                >
                  {t('scannedDeepUpgrade')}
                </Link>
              </p>
            ) : null}
          </div>
          {/* Secondary actions sit left in outline; the primary Share is solid, last. */}
          <div className="flex shrink-0 gap-2">
            {isDashboard ? (
              <Button
                variant={EButtonVariant.DANGER}
                appearance={EButtonAppearance.OUTLINE}
                onPress={deleteConfirm.show}
                ariaLabel={t('deleteScan')}
                isDisabled={scoringPending || rescanning}
                className="px-3.5"
              >
                <TrashIcon />
              </Button>
            ) : (
              <span className="hidden sm:contents">
                <Button
                  variant={EButtonVariant.NEUTRAL}
                  appearance={EButtonAppearance.OUTLINE}
                  href="/"
                >
                  {t('scanAnother')}
                </Button>
              </span>
            )}
            <Button
              variant={EButtonVariant.NEUTRAL}
              appearance={EButtonAppearance.OUTLINE}
              onPress={() => void rescan(report.finalUrl)}
              isDisabled={rescanning || scoringPending}
              ariaLabel={t('rescan')}
              className="px-3.5"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                className={rescanning ? 'animate-spin' : ''}
              >
                <polyline
                  points="23 4 23 10 17 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
            <Button
              variant="primary"
              onPress={() => void share()}
              isDisabled={scoringPending || rescanning}
            >
              <ShareIcon />
              {copied !== null ? t('shared') : t('share')}
            </Button>
          </div>
        </div>
        {deepPending ? (
          <output className="text-site-muted mt-1.5 flex min-w-0 items-center gap-1.5 font-mono text-xs">
            <span
              className="border-site-border border-t-site-accent h-3 w-3 animate-spin rounded-full border-2 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">{deepProgress ?? t('deepScanInProgress')}</span>
          </output>
        ) : null}
      </header>

      <section
        id="score-panel"
        data-anim="panel"
        aria-label={t('overall')}
        className="border-site-border bg-site-surface/50 mt-8 grid items-center gap-8 rounded-2xl border p-5 sm:grid-cols-[auto_1fr] sm:p-8"
      >
        <ScoreRing
          score={overall}
          grade={grade}
          label={scoringPending ? t('scoring') : t(`grade.${grade}`)}
          loading={scoringPending}
        />
        <div className="@container space-y-3">
          <AiSearchBar
            score={aiSearchScore({ base: report.overall, deep: deepScore })}
            pending={scoringPending}
          />
          {showSmartHeadBar ? (
            <SmartAgentBar score={smartScore ?? 0} pending={scoringPending} />
          ) : null}
          <div className="space-y-1.5 pt-1">
            <p className="text-site-muted text-xs leading-relaxed">{t('scoreExplainerBody')}</p>
            <p className="text-site-muted text-xs leading-relaxed">{t('scoreExplainerBody2')}</p>
          </div>
        </div>
      </section>

      <AiSearchSection
        score={aiSearchScore({ base: report.overall, deep: deepScore })}
        categories={categories}
        deep={site !== null}
        pending={deepPending}
      />

      <SmartAgentSection
        status={record.smartStatus}
        report={record.smartReport}
        pending={smartDeepPending}
        deep={site !== null}
      />

      {showDeepScan ? (
        <section data-anim="panel" aria-label={t('deepTitle')} className="mt-10">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-baseline sm:gap-4">
            <h2 className="text-lg font-semibold">{t('deepTitle')}</h2>
            {showSmartDeepScan ? (
              <SegmentedControl
                value={deepView}
                options={[
                  { value: 'standard', label: t('deepViewStandard') },
                  { value: 'smart', label: t('deepViewSmart') },
                ]}
                onChange={setDeepView}
                ariaLabel={t('deepView')}
                className="w-full sm:w-auto"
              />
            ) : null}
          </div>

          <DeepScanSection
            embedded
            active={!showSmartDeepScan || deepView === 'standard'}
            url={report.finalUrl}
            primary={report}
            site={site}
            onDone={persistDeep}
            autoStart={deepAutoStart}
            authenticated={isDashboard}
            premium={premium}
            readOnly={readOnly || shared}
            shared={shared}
            proxyToken={proxyToken}
            onProgress={setDeepProgress}
            onSettle={() => {
              setDeepRan(true)
              setDeepProgress(null)
            }}
          />

          {showSmartDeepScan ? (
            <SmartAgentDeepSection
              embedded
              active={deepView === 'smart'}
              scanId={id}
              site={site}
              initialReport={record?.siteSmartReport ?? null}
              smartReady={record.smartStatus === 'done'}
              premium={premium}
              readOnly={readOnly || shared}
              onSettle={(result) => {
                if (result !== null) {
                  setSiteSmart(result)
                }
                setSmartDeepRan(true)
              }}
            />
          ) : null}
        </section>
      ) : null}

      <section aria-label={t('findings')} className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{t('findings')}</h2>
          {hasFindings ? (
            <button
              type="button"
              onClick={toggleAllFindings}
              className="text-site-muted hover:text-site-accent cursor-pointer text-xs transition-colors"
            >
              {anyOpen ? t('collapseAll') : t('expandAll')}
            </button>
          ) : null}
        </div>
        {!hasFindings ? (
          <p className="text-score-excellent mt-4">{t('noFindings')}</p>
        ) : site === null ? (
          <div ref={findingsRef} className="mt-4 space-y-3">
            {[...failing, ...warning, ...smartFindings].map((check: ICheckResult) => (
              <FindingItem key={check.id} check={check} />
            ))}
          </div>
        ) : (
          <div ref={findingsRef} className="mt-4 space-y-3">
            {siteFindings.map((group) => (
              <FindingItem
                key={group.result.id}
                check={group.result}
                pages={group.pages}
                totalPages={allPages.length}
              />
            ))}
            {smartFindings.map((check) => (
              <FindingItem key={`smart-${check.id}`} check={check} />
            ))}
          </div>
        )}
        {infoChecks.length > 0 ? (
          <details className="group mt-4">
            <summary className="text-site-faint hover:text-site-muted cursor-pointer list-none font-mono text-xs transition-colors select-none [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="inline-block transition-transform group-open:rotate-90"
              >
                ›
              </span>{' '}
              {t('infoNotes', { count: infoChecks.length })}
            </summary>
            <ul className="text-site-muted mt-2 space-y-1 pl-4 text-xs">
              {infoChecks.map((check) => (
                <li key={check.id}>
                  <span className="text-site-faint font-mono">{check.id}</span> — {check.detail}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {isDashboard ? <SolutionSection report={report} premium={premium} /> : null}

      {isDashboard ? (
        <section data-anim="panel" aria-label={t('downloads')} className="mt-10">
          <h2 className="text-lg font-semibold">{t('downloadsOwner')}</h2>
          <p className="text-site-muted mt-1 text-sm">{t('downloadsOwnerHint')}</p>
          <ReportDownloads report={report} />
        </section>
      ) : shared ? null : (
        <>
          <section data-anim="panel" aria-label={t('downloads')} className="mt-10">
            <h2 className="text-lg font-semibold">{t('downloads')}</h2>
            <p className="text-site-muted mt-1 text-sm">{t('downloadsHint')}</p>
            <EmailReportForm id={id} />
          </section>

          <section data-anim="panel" aria-label={t('solutionTitle')} className="mt-10">
            <h2 className="text-lg font-semibold">{t('solutionTitle')}</h2>
            <p className="text-site-muted mt-1 text-sm">{t('solutionLockedHint')}</p>
            <div className="border-site-accent-dim/40 bg-site-surface/40 mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  className="text-site-accent shrink-0"
                >
                  <path
                    d="M4.5 7V5a3.5 3.5 0 117 0v2m-8 0h9a1 1 0 011 1v5a1 1 0 01-1 1h-9a1 1 0 01-1-1V8a1 1 0 011-1z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t('downloadLlm')}</p>
                  <p className="text-site-muted text-xs">{t('downloadLlmHint')}</p>
                </div>
              </div>
              <Button variant="secondary" href="/login" className="min-h-10 shrink-0 px-4 text-xs">
                {t('downloadLlmLocked')}
              </Button>
            </div>
            <div className="border-site-accent-dim/40 bg-site-surface/40 mt-3 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  className="text-site-accent shrink-0"
                >
                  <path
                    d="M2.5 3.5h11a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2.5V11.5H2.5a1 1 0 01-1-1v-6a1 1 0 011-1z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('chatExpert')}</p>
                  <p className="text-site-muted text-xs">{t('chatExpertHint')}</p>
                </div>
              </div>
              <Button variant="secondary" href="/login" className="min-h-10 shrink-0 px-4 text-xs">
                {t('downloadLlmLocked')}
              </Button>
            </div>
          </section>
        </>
      )}

      {!isDashboard && !shared ? (
        <>
          <section data-anim="panel" aria-label={t('saveTitle')} className="mt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{t('saveTitle')}</h2>
                <p className="text-site-muted mt-1 text-sm">{t('saveHint')}</p>
              </div>
              <Button variant="primary" href="/login" className="shrink-0">
                {t('saveCta')}
              </Button>
            </div>
          </section>

          <section data-anim="panel" aria-label={t('badgeTitle')} className="mt-10">
            <h2 className="text-lg font-semibold">{t('badgeTitle')}</h2>
            <p className="text-site-muted mt-1 text-sm">
              {t('badgeHint', { host: hostOf(report.finalUrl) })}
            </p>
            <div className="border-site-border bg-site-surface/50 mt-4 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <img
                  src={badgeDataUrl(overall, grade)}
                  alt={`AI ready ${overall}`}
                  height={20}
                  className="h-5 w-auto shrink-0"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-mono text-sm">
                  <svg
                    aria-hidden="true"
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    className="text-site-accent shrink-0"
                  >
                    <path
                      d="M4.5 7V5a3.5 3.5 0 117 0v2m-8 0h9a1 1 0 011 1v5a1 1 0 01-1 1h-9a1 1 0 01-1-1V8a1 1 0 011-1z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-site-accent truncate">
                    {t('badgeClaim', { host: hostOf(report.finalUrl) })}
                  </span>
                </p>
                <p className="text-site-muted mt-1 text-xs">{t('badgeClaimHint')}</p>
              </div>
              <Button variant="secondary" href="/login" className="min-h-10 shrink-0 px-4 text-xs">
                {t('badgeSignup')}
              </Button>
            </div>
          </section>

          <PremiumTiers className="mt-10" prices={prices} />
        </>
      ) : null}

      <footer className="text-site-muted mt-10 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs">
        <span>
          {passed} {t('passed')}
        </span>
        <span>
          {warnedCount} {t('warnings')}
        </span>
        <span>
          {failedCount} {t('failedCount')}
        </span>
        <span>
          {t('scannedIn')} {report.meta.durationMs} ms
        </span>
        <span>score v{report.scoreVersion}</span>
      </footer>
      <AskYourSite
        scanId={id}
        websiteId={websiteId}
        isReady={record.smartStatus === 'done'}
        authenticated={isDashboard}
        premium={premium}
        smartScore={smartScore}
        readinessScore={overall}
      />
      {isDashboard ? (
        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={deleteConfirm.setOpen}
          title={t('deleteConfirmTitle')}
          description={t('deleteConfirmBody', { host: hostOf(report.finalUrl) })}
          confirmLabel={t('deleteConfirmCta')}
          cancelLabel={t('deleteCancel')}
          destructive
          pending={deleting}
          onConfirm={() => void deleteScan()}
        />
      ) : null}
    </article>
  )
}

// MARK: - Pieces

/**
 * Adapts a Smart Agent signal to the ICheckResult shape FindingItem renders.
 * `category` is structurally required but never read by FindingItem; the
 * smart-agent categories are a separate union, so the nearest scanner category
 * stands in for it.
 */
function smartSignalToCheck(signal: ISmartAgentSignal): ICheckResult {
  return {
    id: signal.id,
    category: ECategory.GEO_CONTENT,
    status: signal.status,
    score: signal.score,
    weight: signal.weight,
    title: signal.title,
    detail: signal.detail,
    fix: signal.fix,
  }
}

/** `…/path` → `…/path/*`, `…/` → `…/*` — signals the report covers the whole site. */
function wildcardUrl(url: string): string {
  return url.endsWith('/') ? `${url}*` : `${url}/*`
}

function EmptyState({ title, hint, ctaLabel }: { title: string; hint: string; ctaLabel: string }) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-site-muted mt-2 text-sm">{hint}</p>
      <Button variant="primary" href="/" className="mt-6">
        {ctaLabel}
      </Button>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <polyline
        points="3 6 5 6 21 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="10"
        y1="11"
        x2="10"
        y2="17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="11"
        x2="14"
        y2="17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path
        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="17 8 12 3 7 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="12"
        y1="3"
        x2="12"
        y2="15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
