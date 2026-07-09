'use client'

import type { IDataTableColumn, IDataTableSort } from '@/components/ui/data-table'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  DataTable,
  RowActions,
  ETableSortDir,
  ETableState,
  ETableAlign,
} from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { CompactReport } from '@/components/dashboard/compact-report'
import { CopyButton } from '@/components/ui/copy-button'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { dayjs } from '@/lib/dayjs'
import { useBrowserTimeZone } from '@/lib/use-browser-time-zone'
import type { TCiWorkflowAction } from '@/lib/ci-workflow-snippets'
import { CI_WORKFLOW_SNIPPETS, ECiWorkflowAction } from '@/lib/ci-workflow-snippets'
import { CiWorkflowSnippet } from '@/components/ci-workflow-snippet'

// MARK: - CI repos table (audit-action uploads)

export interface ICiRepoTableRow {
  slug: string
  ownerRepo: string
  branch: string | null
  commit: string | null
  overall: number | null
  failed: number
  warned: number
  isDeep: boolean
  isSmart: boolean
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
 * copyable badge. Mirrors the scans table (filter, compact report, sortable
 * date/score). Renders the first-run activation card in place of the table
 * when there are no rows yet.
 */
export function CiReposTable({ rows }: { rows: ICiRepoTableRow[] }) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const { copied, copy } = useCopyToClipboard()
  const [query, setQuery] = useState('')
  const timeZone = useBrowserTimeZone()
  const [sort, setSort] = useState<IDataTableSort>({ key: 'date', dir: ETableSortDir.DESC })

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((row) => q === '' || row.ownerRepo.toLowerCase().includes(q))
    const factor = sort.dir === ETableSortDir.ASC ? 1 : -1
    return filtered.toSorted((a, b) => {
      if (sort.key === 'score') {
        return ((a.overall ?? -1) - (b.overall ?? -1)) * factor
      }
      const aDate = a.createdAt === null ? 0 : Date.parse(a.createdAt)
      const bDate = b.createdAt === null ? 0 : Date.parse(b.createdAt)
      return (aDate - bDate) * factor
    })
  }, [rows, query, sort])

  if (rows.length === 0) {
    return <CiEmptyState />
  }

  const columns: Array<IDataTableColumn<ICiRepoTableRow>> = [
    {
      key: 'repo',
      header: t('ciColRepo'),
      render: (row) => <span className="text-site-text truncate font-medium">{row.ownerRepo}</span>,
    },
    {
      key: 'branch',
      header: t('ciColBranch'),
      render: (row) =>
        row.branch === null || row.commit === null ? (
          <span className="text-site-faint text-xs">—</span>
        ) : (
          <span className="text-site-faint truncate font-mono text-xs">
            {row.branch} @ {shortCommit(row.commit)}
          </span>
        ),
    },
    {
      key: 'score',
      header: t('ciColReport'),
      sortable: true,
      render: (row) => (
        <CompactReport
          data={{
            overall: row.overall,
            failed: row.failed,
            warned: row.warned,
            isDeep: row.isDeep,
            isSmart: row.isSmart,
            emptyLabel: t('ciNoReportYet'),
          }}
        />
      ),
    },
    {
      key: 'date',
      header: t('colDate'),
      sortable: true,
      align: ETableAlign.END,
      render: (row) => (
        <span className="text-site-faint text-xs whitespace-nowrap">
          {row.createdAt === null
            ? '—'
            : dayjs
                .utc(row.createdAt)
                .tz(timeZone ?? 'UTC')
                .format('DD/MM/YYYY, HH:mm:ss')}
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

  const filtering = query.trim() !== ''
  const state =
    visible.length > 0
      ? ETableState.IDLE
      : filtering
        ? ETableState.FILTERED_EMPTY
        : ETableState.EMPTY

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <TextInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('ciSearch')}
        aria-label={t('ciSearch')}
        surface="subtle"
      />

      <DataTable
        fill
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.slug}
        onRowClick={(row) => {
          if (row.reportPath !== null) {
            router.push(row.reportPath)
          }
        }}
        sort={sort}
        onSortChange={setSort}
        state={state}
        filteredEmptyState={<EmptyState title={t('ciFilteredEmpty')} />}
      />
    </div>
  )
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
