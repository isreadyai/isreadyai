'use client'

import { useTranslations } from 'next-intl'
import {
  DataTable,
  ETableAlign,
  ETableState,
  type IDataTableColumn,
} from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { hostOf } from '@/lib/url'

// MARK: - Fix runs table

export interface IFixRunRow {
  id: string
  repo: string
  url: string
  patches: number
  created_at: string
}

/** Renders recent fix runs with repo, patches, and date columns. */
export function FixRunsTable({ runs }: { runs: IFixRunRow[] }) {
  const t = useTranslations('dashboard')

  const columns: Array<IDataTableColumn<IFixRunRow>> = [
    {
      key: 'repo',
      header: t('usageColRepo'),
      render: (run) => (
        <div className="min-w-0">
          <p className="text-site-text truncate font-mono text-sm">{run.repo}</p>
          <p className="text-site-faint truncate text-xs">{hostOf(run.url)}</p>
        </div>
      ),
    },
    {
      key: 'patches',
      header: t('usageColPatches'),
      align: ETableAlign.END,
      render: (run) => (
        <span className="text-site-muted text-xs">{t('usagePatches', { count: run.patches })}</span>
      ),
    },
    {
      key: 'date',
      header: t('usageColDate'),
      align: ETableAlign.END,
      render: (run) => (
        <span className="text-site-faint text-xs whitespace-nowrap">
          {new Date(run.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={runs}
      getRowKey={(run) => run.id}
      state={runs.length === 0 ? ETableState.EMPTY : ETableState.IDLE}
      emptyState={<EmptyState title={t('usageEmptyTitle')} description={t('usageEmptyBody')} />}
    />
  )
}
