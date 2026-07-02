'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { GITHUB_URL } from '@/lib/site'
import { badgeDataUrl } from '@/lib/badge-svg'
import type { TCiWorkflowAction } from '@/lib/ci-workflow-snippets'
import { ECiWorkflowAction } from '@/lib/ci-workflow-snippets'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { CopyButton } from '@/components/ui/copy-button'
import { CiWorkflowSnippet } from '@/components/ci-workflow-snippet'

// MARK: - GitHub Action showcase (Marketplace-style card)

// Tokenless: the badge is served live for a VERIFIED domain at /badge/<host>.
// The audit action's `api-key` upload is a separate mechanism: it produces a
// branch-stable repo badge at /badge/gh/<slug>/<branch> instead.
const BADGE_MD = '[![AI ready](https://isready.ai/badge/yourdomain.com)](https://isready.ai)'
const BADGE_PREVIEW = badgeDataUrl(92, 'excellent')

export function GithubShowcase() {
  const t = useTranslations('gh')

  // MARK: - Variables
  const { copied, copy } = useCopyToClipboard()
  const [workflowAction, setWorkflowAction] = useState<TCiWorkflowAction>(ECiWorkflowAction.AUDIT)

  return (
    <div className="border-site-border bg-site-background overflow-hidden rounded-2xl border shadow-2xl">
      <div className="border-site-border/60 bg-site-surface/60 flex min-w-0 items-center gap-3 border-b px-4 py-4 sm:px-5">
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 16 16"
          className="text-site-text shrink-0"
        >
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold">IsReadyAI — readiness audit</p>
          <p className="text-site-faint truncate text-xs">isreadyai/audit-action</p>
        </div>
        <span className="border-site-accent-dim text-site-accent hidden shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wide uppercase sm:inline-flex">
          {t('marketplaceTag')}
        </span>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <CiWorkflowSnippet
          action={workflowAction}
          onActionChange={setWorkflowAction}
          switchAriaLabel={t('workflowSwitchAria')}
          switchOptions={[
            { value: ECiWorkflowAction.AUDIT, label: t('auditOption') },
            { value: ECiWorkflowAction.FIX, label: t('fixOption') },
          ]}
          copyLabel={t('copy')}
          copiedLabel={t('copied')}
          preClassName="bg-site-surface/60"
        />
        <p className="text-site-faint mt-3 text-xs leading-snug">
          {workflowAction === ECiWorkflowAction.AUDIT ? t('auditActionText') : t('fixActionText')}
        </p>
      </div>

      <div className="border-site-border/60 border-t px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-site-muted text-xs font-medium tracking-wide uppercase">
            {t('badgeLabel')}
          </p>
          <CopyButton
            copied={copied === 'badge'}
            onCopy={() => void copy(BADGE_MD, 'badge')}
            copyLabel={t('copy')}
            copiedLabel={t('copied')}
          />
        </div>
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <img
            src={BADGE_PREVIEW}
            alt={t('badgeAlt')}
            height={20}
            className="h-5 w-auto shrink-0"
          />
          <p className="text-site-faint min-w-0 flex-1 text-xs leading-snug">{t('badgeText')}</p>
        </div>
      </div>

      <div className="border-site-border/60 bg-site-surface/40 border-t px-4 py-3 sm:px-5">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('viewOnGithubAria')}
          className="text-site-muted hover:text-site-accent inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          {t('viewOnGithub')}
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 12 12">
            <path
              d="M3.5 2h6.5v6.5M10 2L2 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>
  )
}
