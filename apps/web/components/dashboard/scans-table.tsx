'use client'

import type { TGrade } from '@isreadyai/scanner'
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
import { CompactReport } from '@/components/dashboard/compact-report'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { dayjs } from '@/lib/dayjs'
import { useBrowserTimeZone } from '@/lib/use-browser-time-zone'

// MARK: - Scans table (filterable, compact report per row)

export interface IScanRow {
  id: string
  host: string
  status: string
  createdAt: string
  overall: number | null
  grade: TGrade | null
  failed: number
  warned: number
  isDeep: boolean
  isSmart: boolean
}

/** Filterable scans table with compact report and sort-by-score/date. */
export function ScansTable({
  rows,
  basePath = '/dashboard/scans',
  searchable = true,
  fill = true,
}: {
  rows: IScanRow[]
  /** Where a row links. Defaults to the flat scans route; the My Websites detail
   * passes a site-nested base so the scan opens under that website. */
  basePath?: string
  /** Hide the search field when embedded as a compact recent-scans widget. */
  searchable?: boolean
  /** Fill the parent height with an internal scroll; off for embedded widgets. */
  fill?: boolean
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [query, setQuery] = useState('')
  const timeZone = useBrowserTimeZone()
  // Default sort by most recent; the Report column header sorts by score.
  const [sort, setSort] = useState<IDataTableSort>({ key: 'date', dir: ETableSortDir.DESC })

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((r) => q === '' || r.host.includes(q))
    const factor = sort.dir === ETableSortDir.ASC ? 1 : -1
    return filtered.toSorted((a, b) => {
      if (sort.key === 'score') {
        return ((a.overall ?? -1) - (b.overall ?? -1)) * factor
      }
      return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * factor
    })
  }, [rows, query, sort])

  const columns: Array<IDataTableColumn<IScanRow>> = [
    {
      key: 'host',
      header: t('colSite'),
      render: (row) => <span className="text-site-text truncate font-medium">{row.host}</span>,
    },
    {
      // The compact report already carries the score, so this column sorts by it.
      key: 'score',
      header: t('colReport'),
      sortable: true,
      render: (row) => (
        <CompactReport
          data={{
            overall: row.overall,
            failed: row.failed,
            warned: row.warned,
            isDeep: row.isDeep,
            isSmart: row.isSmart,
            emptyLabel: row.status,
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
          {dayjs
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
      render: (row) => <RowActions detailHref={`${basePath}/${row.id}`} openLabel={t('rowOpen')} />,
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
    <div className={fill ? 'flex min-h-0 flex-1 flex-col gap-4' : 'flex flex-col gap-4'}>
      {searchable ? (
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('scansSearch')}
          aria-label={t('scansSearch')}
          surface="subtle"
        />
      ) : null}

      <DataTable
        fill={fill}
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`${basePath}/${row.id}`)}
        sort={sort}
        onSortChange={setSort}
        state={state}
        filteredEmptyState={<EmptyState title={t('scansFilteredEmpty')} />}
      />
    </div>
  )
}
