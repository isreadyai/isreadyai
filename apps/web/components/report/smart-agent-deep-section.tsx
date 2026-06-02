'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ISiteCluster, ISiteReport, ISmartAgentSiteReport } from '@isreadyai/scanner'
import { Button } from '@/components/ui/button'
import { notify } from '@/components/ui/toast'
import type { TScanRunPhase } from '@/lib/scan-record'
import { DeepClusterCard } from './deep-cluster-card'

// MARK: - Premium deep Smart Agent pass (mirrors the Deep scan section UI)

/**
 * Same shell as DeepScanSection — header + CTA, a running spinner, then a
 * cluster card — but driven by the browser-capable Smart Agent audit. Auto-
 * runs once when a deep scan is present and the single-page Smart Agent is ready
 * (Smart agent readability on + Deep scan on).
 */

// Auto-run can fire before the deep-scan siteReport PATCH commits server-side; a
// 404 is that race, so retry a few times (~6s) before falling back to the CTA.
const DEEP_RETRY_MAX = 3
const DEEP_RETRY_DELAY_MS = 1500

export function SmartAgentDeepSection({
  scanId,
  site,
  initialReport,
  smartReady = false,
  premium = false,
  readOnly = false,
  onSettle,
  embedded = false,
  active = true,
}: {
  scanId: string
  site: ISiteReport | null
  initialReport: ISmartAgentSiteReport | null
  smartReady?: boolean
  /** Premium-only pass: non-premium never auto-runs it (the endpoint would 403). */
  premium?: boolean
  /** Past scan: never auto-run or offer the run CTA — it would mutate the record. */
  readOnly?: boolean
  /** Lifts the result (or null on failure) so the main score can settle. */
  onSettle?: (report: ISmartAgentSiteReport | null) => void
  /** Render as a tab body (no section/heading) inside the unified Deep scan block. */
  embedded?: boolean
  /** When embedded, hidden unless this is the active tab (stays mounted to auto-run). */
  active?: boolean
}) {
  const t = useTranslations('report.smartAgent')
  const [report, setReport] = useState<ISmartAgentSiteReport | null>(initialReport)
  const [phase, setPhase] = useState<TScanRunPhase>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const started = useRef(false)
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Premium surfaces the failure inline (the auto-run is otherwise invisible);
  // non-premium keeps the transient toast on its manual upsell click.
  function fail(code: string): void {
    setPhase('failed')
    if (premium) {
      setErrorCode(code)
    } else {
      notify.warning(t('deepFailed'))
    }
    onSettle?.(null)
  }

  async function run(attempt = 0): Promise<void> {
    setErrorCode(null)
    setPhase('running')
    let key = ''
    try {
      key = sessionStorage.getItem('isready:premium-api-key') ?? ''
    } catch {
      key = ''
    }
    // Send one representative URL per structural cluster — the AI Search crawl
    // already did the template-sampling, so no further dedup is needed here.
    // The server audits the given URLs directly without re-sampling.
    const pageUrls = site === null ? [] : (site.clusters ?? []).map((c) => c.representativeUrl)
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (key.length > 0) {
      headers.Authorization = `Bearer ${key}`
    }
    try {
      const response = await fetch(`/api/scan/${scanId}/smart-deep`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pageUrls }),
      })
      if (!response.ok) {
        // The deep crawl persists its siteReport via a separate, fire-and-forget
        // PATCH that can land after this pass starts; a 404 means the server has
        // not stored it yet, so wait and retry before giving up (the spinner holds).
        if (response.status === 404 && attempt < DEEP_RETRY_MAX) {
          retryTimer.current = setTimeout(() => void run(attempt + 1), DEEP_RETRY_DELAY_MS)
          return
        }
        fail(await errorCodeOf(response))
        return
      }
      const result = (await response.json()) as ISmartAgentSiteReport
      setReport(result)
      setPhase('idle')
      onSettle?.(result)
    } catch {
      fail('unknown')
    }
  }

  // Auto-run once when both conditions hold: deep scan present and the single-
  // page Smart Agent settled as ready. On failure premium sees the inline error
  // block below (with Try again); non-premium never auto-runs.
  useEffect(() => {
    if (
      premium &&
      !readOnly &&
      smartReady &&
      site !== null &&
      report === null &&
      !started.current
    ) {
      started.current = true
      void run()
    }
    // run/scanId are stable for a given scan; deps kept minimal on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premium, smartReady, site, report, readOnly])

  useEffect(() => {
    return () => {
      if (retryTimer.current !== undefined) {
        clearTimeout(retryTimer.current)
      }
    }
  }, [])

  // Only meaningful once a deep scan has produced the page set.
  if (site === null) {
    return null
  }

  // Match each audited page back to its source cluster by representativeUrl to
  // build agent-scored cluster rows. We sent clusters in order, so position is
  // deterministic (primary → clusters[0], pages[i] → clusters[i+1]).
  // Deep reports persisted before structural clustering shipped carry no
  // `clusters`; treat them as cluster-less rather than crashing the report.
  const clusters = site.clusters ?? []
  const auditedPages = report !== null ? [report.primary, ...report.pages] : []
  const agentScoreByUrl = new Map(auditedPages.map((p) => [p.finalUrl, p.overall]))
  const agentClusters: ISiteCluster[] =
    report !== null
      ? clusters
          .map((c): ISiteCluster | null => {
            const agentScore = agentScoreByUrl.get(c.representativeUrl)
            if (agentScore === undefined) return null
            return {
              id: c.id,
              representativeUrl: c.representativeUrl,
              pageUrls: c.pageUrls,
              pageCount: c.pageCount,
              scannedCount: 1,
              avgScore: agentScore,
            }
          })
          .filter((c): c is ISiteCluster => c !== null)
      : []

  const content = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {embedded ? null : <h2 className="text-lg font-semibold">{t('deepTitle')}</h2>}
          <p className={`text-site-muted text-sm ${embedded ? '' : 'mt-1'}`}>{t('deepHint')}</p>
        </div>
        {report === null && phase !== 'running' && !readOnly && (!premium || errorCode === null) ? (
          <Button variant="secondary" onPress={() => void run()} className="shrink-0">
            {premium ? t('deepCtaRun') : t('deepCta')}
          </Button>
        ) : null}
      </div>

      {phase === 'running' ? (
        <output className="mt-4 flex items-center gap-3">
          <div
            className="border-site-border border-t-site-accent h-5 w-5 animate-spin rounded-full border-2"
            aria-hidden="true"
          />
          <p className="text-site-muted truncate font-mono text-xs">{t('deepRunning')}</p>
        </output>
      ) : null}

      {premium && report === null && errorCode !== null && phase !== 'running' && !readOnly ? (
        <div
          className="border-score-poor/30 bg-score-poor/5 mt-4 flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-site-foreground min-w-0 text-sm">{t(deepErrorKey(errorCode))}</p>
          <Button variant="secondary" onPress={() => void run()} className="shrink-0">
            {t('deepRetry')}
          </Button>
        </div>
      ) : null}

      {agentClusters.length > 0 ? (
        <DeepClusterCard
          clusters={agentClusters}
          found={site.discovered}
          scanned={agentClusters.length}
          scannedLabel="audited"
        />
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

async function errorCodeOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === 'string' && body.error.length > 0 ? body.error : 'unknown'
  } catch {
    return 'unknown'
  }
}

// Maps the route's error code to a plain-language i18n key (under report.smartAgent).
// Unknown codes (e.g. a future server error) fall back to the generic message.
function deepErrorKey(code: string): string {
  switch (code) {
    case 'forbidden':
      return 'deepError.forbidden'
    case 'premium_required':
      return 'deepError.premiumRequired'
    case 'rate_limited':
      return 'deepError.rateLimited'
    case 'deep_scan_required':
      return 'deepError.deepScanRequired'
    case 'smart_deep_failed':
      return 'deepError.failed'
    default:
      return 'deepError.unknown'
  }
}
