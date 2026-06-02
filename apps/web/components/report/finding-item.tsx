'use client'

import { useTranslations } from 'next-intl'
import type { ICheckResult } from '@isreadyai/scanner'

// MARK: - Finding item

export function FindingItem({
  check,
  pages,
  totalPages,
}: {
  check: ICheckResult
  /** Deep-scan mode: finalUrls of the pages this check fails/warns on. */
  pages?: string[]
  totalPages?: number
}) {
  const t = useTranslations('report')
  const failed = check.status === 'fail'

  return (
    <details
      data-anim="finding"
      className="border-site-border bg-site-surface/50 group overflow-hidden rounded-xl border"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className={`mt-0.5 font-mono ${failed ? 'text-score-poor' : 'text-score-moderate'}`}
        >
          {failed ? '✗' : '▲'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{check.title}</span>
          <span className="text-site-muted block text-sm">{check.detail}</span>
          {pages !== undefined && totalPages !== undefined ? (
            <span
              className={`mt-1 block font-mono text-xs sm:hidden ${failed ? 'text-score-poor' : 'text-score-moderate'}`}
            >
              {t('pagesBadge', { count: pages.length, total: totalPages })}
            </span>
          ) : null}
        </span>
        {pages !== undefined && totalPages !== undefined ? (
          <span
            className={`mt-1 hidden shrink-0 font-mono text-xs sm:block ${failed ? 'text-score-poor' : 'text-score-moderate'}`}
          >
            {t('pagesBadge', { count: pages.length, total: totalPages })}
          </span>
        ) : null}
        <span className="text-site-faint mt-1 hidden shrink-0 font-mono text-xs sm:block">
          {check.id}
        </span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          className="text-site-faint mt-1 shrink-0 transition-transform duration-200 group-open:rotate-180"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="border-site-border/60 space-y-3 border-t px-5 py-4 pl-12 text-sm">
        {check.fix !== undefined ? (
          <p>
            <span className="text-site-accent font-medium">{t('fix')}: </span>
            <span className="text-site-muted">{check.fix}</span>
          </p>
        ) : null}
        <div className="text-site-faint flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
          {check.impact !== undefined ? (
            <span>
              {t('impact')}: {check.impact}
            </span>
          ) : null}
          {check.effort !== undefined ? (
            <span>
              {t('effort')}: {check.effort}
            </span>
          ) : null}
          {check.docsUrl !== undefined ? (
            <a
              href={check.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-site-accent hover:underline"
              aria-label={`${t('docs')} (opens in a new tab)`}
            >
              {t('docs')} ↗
            </a>
          ) : null}
        </div>
        {pages !== undefined && pages.length > 0 ? (
          <div>
            <p className="text-site-accent text-xs font-medium">{t('affectedPages')}</p>
            <ul className="text-site-muted mt-1 space-y-0.5 font-mono text-xs">
              {pages.map((page) => (
                <li key={page} className="truncate">
                  {pathOf(page)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {check.evidence !== undefined ? (
          <pre className="bg-site-background border-site-border/60 overflow-x-auto rounded-lg border p-3 font-mono text-xs">
            {JSON.stringify(check.evidence, null, 2)}
          </pre>
        ) : null}
      </div>
    </details>
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
