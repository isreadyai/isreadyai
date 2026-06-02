'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ISiteCluster } from '@isreadyai/scanner'
import { templateKey } from '@isreadyai/scanner'
import { textForScore } from '@/lib/grade'

// MARK: - Shared cluster card (AI Search + Smart Agent)

const DEEP_PAGE_CAP = 10

const TEMPLATE_PLACEHOLDERS = new Set([':n', ':uuid', ':date', ':hash', ':slug'])

// Cluster header rows stand for N pages — show the URL template pattern, not
// the literal representative path (/eventi/:slug → /eventi/*).
// Static routes have no placeholder segments so they render unchanged.
function templatePattern(url: string): string {
  return templateKey(url)
    .split('/')
    .map((segment) => (TEMPLATE_PLACEHOLDERS.has(segment) ? '*' : segment))
    .join('/')
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname === '/' ? parsed.host : `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
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

export function DeepClusterCard({
  clusters,
  found,
  scanned,
  scannedLabel = 'scanned',
  memberScore,
}: {
  clusters: ISiteCluster[]
  /** Total pages discovered (site.discovered). */
  found: number
  /** Pages actually fetched — caller computes (e.g. sum of cluster.scannedCount). */
  scanned: number
  /** Word appended after the scanned count in the header ("scanned" | "audited"). */
  scannedLabel?: string
  /** Returns score + fail-count for a member URL; omit to render member rows without scores. */
  memberScore?: (finalUrl: string) => { overall: number; failCount: number } | undefined
}) {
  const t = useTranslations('report')

  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [expandedClusters, setExpandedClusters] = useState(new Set<number>())

  function toggleCluster(id: number): void {
    setExpandedClusters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const query = filter.trim().toLowerCase()
  const visibleClusters =
    query === ''
      ? clusters
      : clusters.filter(
          (c) =>
            c.representativeUrl.toLowerCase().includes(query) ||
            c.pageUrls.some((u) => u.toLowerCase().includes(query)),
        )
  const showCapToggle = visibleClusters.length > DEEP_PAGE_CAP
  const listedClusters = !showAll ? visibleClusters.slice(0, DEEP_PAGE_CAP) : visibleClusters

  return (
    <div className="border-site-border bg-site-surface/50 mt-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="text-site-muted min-w-0 text-sm sm:truncate">
          {t('deepSummaryTemplates', {
            templates: clusters.length,
            found,
            scanned,
            label: scannedLabel,
          })}
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
        <ul className="mt-3 space-y-2">
          {listedClusters.map((cluster) => {
            const isOpen = expandedClusters.has(cluster.id)
            return (
              <li key={cluster.id}>
                <button
                  type="button"
                  onClick={() => toggleCluster(cluster.id)}
                  aria-expanded={isOpen}
                  className="grid w-full grid-cols-[auto_2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-left font-mono text-xs sm:flex"
                >
                  <span
                    aria-hidden="true"
                    className={`text-site-accent shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  >
                    ›
                  </span>
                  <span
                    className={`${textForScore(cluster.avgScore)} w-8 shrink-0 text-right font-semibold`}
                  >
                    {cluster.avgScore}
                  </span>
                  <span className="bg-site-raised h-1.5 w-full min-w-0 overflow-hidden rounded-full sm:w-24 sm:shrink-0">
                    <span
                      className={`${textForScore(cluster.avgScore)} block h-full rounded-full bg-current`}
                      style={{ width: `${cluster.avgScore}%` }}
                    />
                  </span>
                  <span className="text-site-muted col-span-2 col-start-2 row-start-2 min-w-0 truncate sm:col-auto sm:row-auto">
                    {templatePattern(cluster.representativeUrl)}
                  </span>
                  <span className="text-site-faint col-span-2 col-start-2 row-start-3 min-w-0 justify-self-start text-left sm:col-auto sm:row-auto sm:ml-auto sm:shrink-0">
                    {cluster.scannedCount < cluster.pageCount
                      ? t('deepClusterPagesSampled', {
                          count: cluster.pageCount,
                          scanned: cluster.scannedCount,
                          label: scannedLabel,
                        })
                      : t('deepClusterPages', { count: cluster.pageCount })}
                  </span>
                </button>
                {isOpen ? (
                  <ul className="mt-1.5 space-y-1.5 pl-6">
                    {cluster.pageUrls.map((memberUrl) => {
                      const info = memberScore?.(memberUrl)
                      return (
                        <li key={memberUrl} className="flex items-center gap-3 font-mono text-xs">
                          {info !== undefined ? (
                            <>
                              <span
                                className={`${textForScore(info.overall)} w-8 text-right font-semibold`}
                              >
                                {info.overall}
                              </span>
                              <span className="bg-site-raised h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                                <span
                                  className={`${textForScore(info.overall)} block h-full rounded-full bg-current`}
                                  style={{ width: `${info.overall}%` }}
                                />
                              </span>
                            </>
                          ) : null}
                          <span className="text-site-muted min-w-0 truncate">
                            {pathOf(memberUrl)}
                          </span>
                          {info !== undefined ? (
                            info.failCount > 0 ? (
                              <span className="text-score-poor ml-auto shrink-0">
                                ✗ {info.failCount}
                              </span>
                            ) : (
                              <span className="text-score-excellent ml-auto shrink-0">✓</span>
                            )
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
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
  )
}
