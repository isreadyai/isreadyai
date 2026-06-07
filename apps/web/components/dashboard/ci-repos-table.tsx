'use client'

import type { TGrade } from '@isreadyai/scanner'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  DataTable,
  ETableAlign,
  RowActions,
  type IDataTableColumn,
} from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { EmptyState } from '@/components/ui/empty-state'
import { GRADE_COLORS } from '@/lib/grade'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import type { TCiWorkflowAction } from '@/lib/ci-workflow-snippets'
import { CI_WORKFLOW_SNIPPETS, ECiWorkflowAction } from '@/lib/ci-workflow-snippets'
import { CiWorkflowSnippet } from '@/components/ci-workflow-snippet'

// MARK: - CI repos table (audit-action uploads)

export interface ICiRepoTableRow {
  slug: string
  ownerRepo: string
  branch: string | null
  commit: string | null
  score: number | null
  grade: TGrade | null
  createdAt: string | null
  /** Internal route to the permanent report page; null until the first CI report lands. */
  reportPath: string | null
  /** README-ready badge markdown (absolute URLs); null until the first CI report lands. */
  badgeMarkdown: string | null
}

function shortCommit(commit: string): string {
  return commit.slice(0, 7)
}

/**
 * Lists the workspace's CI-connected repos with their latest report and a
 * copyable badge. Renders the first-run activation card in place of the table
 * (no rows means no columns to show yet) — mirrors how the website detail's
 * scan history and the overview page's recent-scans/monitored-sites sections
 * swap a bare table for `EmptyState` rather than routing an empty, non-filterable
 * list through `DataTable`'s in-table empty slot.
 */
export function CiReposTable({ rows }: { rows: ICiRepoTableRow[] }) {
  const t = useTranslations('dashboard')
  const tr = useTranslations('report')
  const { copied, copy } = useCopyToClipboard()

  if (rows.length === 0) {
    return <CiEmptyState />
  }

  const columns: Array<IDataTableColumn<ICiRepoTableRow>> = [
    {
      key: 'repo',
      header: t('ciColRepo'),
      render: (row) => (
        <span className="text-site-text block truncate font-mono text-sm">{row.ownerRepo}</span>
      ),
    },
    {
      key: 'report',
      header: t('ciColReport'),
      render: (row) =>
        row.score === null || row.grade === null || row.branch === null || row.commit === null ? (
          <span className="text-site-muted text-xs">{t('ciNoReportYet')}</span>
        ) : (
          <div className="min-w-0">
            <span
              className="font-mono text-xs font-semibold tracking-wide uppercase"
              style={{ color: GRADE_COLORS[row.grade] }}
            >
              {row.score} · {tr(`grade.${row.grade}`)}
            </span>
            <p className="text-site-faint truncate text-xs">
              {row.branch} @ {shortCommit(row.commit)}
            </p>
          </div>
        ),
    },
    {
      key: 'date',
      header: t('colDate'),
      align: ETableAlign.END,
      render: (row) => (
        <span className="text-site-faint text-xs whitespace-nowrap">
          {row.createdAt === null ? '—' : new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('colActions'),
      align: ETableAlign.END,
      render: (row) =>
        row.reportPath === null || row.badgeMarkdown === null ? (
          <span className="text-site-faint text-xs">—</span>
        ) : (
          <RowActions detailHref={row.reportPath} openLabel={t('ciViewReport')}>
            <CopyButton
              copied={copied === row.slug}
              onCopy={() => void copy(row.badgeMarkdown ?? '', row.slug)}
              copyLabel={t('copy')}
              copiedLabel={t('copied')}
            />
          </RowActions>
        ),
    },
  ]

  return <DataTable columns={columns} rows={rows} getRowKey={(row) => row.slug} />
}

/**
 * First-run activation guide: a plain `EmptyState` (icon/title/description,
 * matching every other dashboard empty state) followed by a card for the
 * audit/fix switcher — kept OUTSIDE EmptyState's centered `action` slot so
 * the switcher, steps and snippet get the card's full usable width instead
 * of EmptyState's narrow column. Both are direct children of one full-width
 * wrapper, so they span the same content-area width as every other
 * dashboard card.
 */
function CiEmptyState() {
  const t = useTranslations('dashboard')
  const [action, setAction] = useState<TCiWorkflowAction>(ECiWorkflowAction.AUDIT)
  const snippet = CI_WORKFLOW_SNIPPETS[action]
  const isAudit = action === ECiWorkflowAction.AUDIT
  const repoName = isAudit ? 'audit-action' : 'fix-action'
  const steps = isAudit
    ? [t('ciEmptyAuditStep1'), t('ciEmptyAuditStep2'), t('ciEmptyAuditStep3')]
    : [t('ciEmptyFixStep1'), t('ciEmptyFixStep2'), t('ciEmptyFixStep3')]
  const planNote = isAudit ? t('ciEmptyPlanNoteAudit') : t('ciEmptyPlanNoteFix')

  return (
    <div className="w-full space-y-6">
      <EmptyState title={t('ciEmptyTitle')} description={t('ciEmptyBody')} />
      <div className="border-site-border bg-site-surface/60 rounded-2xl border p-6 text-left">
        <CiWorkflowSnippet
          action={action}
          onActionChange={setAction}
          switchAriaLabel={t('ciWorkflowSwitchAria')}
          switchOptions={[
            { value: ECiWorkflowAction.AUDIT, label: t('ciAuditOption') },
            { value: ECiWorkflowAction.FIX, label: t('ciFixOption') },
          ]}
          copyLabel={t('copy')}
          copiedLabel={t('copied')}
          preClassName="bg-site-raised/40"
        >
          <ol className="text-site-muted mt-2 list-decimal space-y-1 pl-4 text-xs leading-snug">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </CiWorkflowSnippet>
        <p className="text-site-faint mt-3 text-xs leading-snug">{planNote}</p>
        <a
          href={snippet.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t('ciEmptyViewRepo', { action: repoName })} (opens in a new tab)`}
          className="text-site-accent mt-3 inline-flex items-center gap-1 text-xs hover:underline"
        >
          {t('ciEmptyViewRepo', { action: repoName })} ↗
        </a>
        <div className="mt-3 flex justify-end">
          <Button href="/dashboard/api-keys">{t('ciEmptyKeyCta')}</Button>
        </div>
      </div>
    </div>
  )
}
