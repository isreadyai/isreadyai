'use client'

import type { IDataTableColumn } from '@/components/ui/data-table'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DataTable, RowActions, ETableAlign } from '@/components/ui/data-table'

// MARK: - Monitored sites table

export interface IMonitoredSiteRow {
  id: string
  host: string
  overall: number | null
  nextCheckAt: string | null
}

/** Renders monitored sites with score and next check date for overview dashboard. */
export function MonitoredSitesTable({ rows }: { rows: IMonitoredSiteRow[] }) {
  const t = useTranslations('dashboard')
  const router = useRouter()

  const columns: Array<IDataTableColumn<IMonitoredSiteRow>> = [
    {
      key: 'host',
      header: t('colSite'),
      render: (row) => <span className="text-site-text truncate font-medium">{row.host}</span>,
    },
    {
      key: 'score',
      header: t('colReport'),
      render: (row) => (
        <span
          className={`font-mono font-semibold ${row.overall === null ? 'text-site-faint' : 'text-site-secondary'}`}
        >
          {row.overall ?? '—'}
        </span>
      ),
    },
    {
      key: 'next',
      header: t('colNextCheck'),
      align: ETableAlign.END,
      render: (row) => (
        <span className="text-site-faint text-xs whitespace-nowrap">
          {row.nextCheckAt !== null ? new Date(row.nextCheckAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('colActions'),
      align: ETableAlign.END,
      render: (row) => (
        <RowActions detailHref={`/dashboard/websites/${row.id}`} openLabel={t('rowOpen')} />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/dashboard/websites/${row.id}`)}
    />
  )
}
