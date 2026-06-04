'use client'

import type { IDataTableColumn, IDataTableSort } from '@/components/ui/data-table'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, EButtonVariant } from '@/components/ui/button'
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
import { notify } from '@/components/ui/toast'
import { addTrackedDomain } from '@/lib/actions/domains'

// MARK: - "My websites" list — a scans-style table of tracked sites

export interface ISiteRow {
  id: string
  host: string
  verifiedAt: string | null
  monitoringEnabled: boolean
  overall: number | null
  failed: number
  warned: number
  isDeep: boolean
  isSmart: boolean
  lastScanAt: string | null
  nextCheckAt: string | null
}

const ADD_ERROR_KEY: Record<string, string> = {
  upgrade_required: 'siteQuota',
  already_tracked: 'siteDuplicate',
  invalid_domain: 'siteInvalid',
}

/** "My websites" list: searchable, sortable tracked sites with status and score. */
export function TrackedSitesClient({
  sites,
  canAddMore,
  limit,
}: {
  sites: ISiteRow[]
  canAddMore: boolean
  limit: number
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [host, setHost] = useState('')
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()
  const [sort, setSort] = useState<IDataTableSort>({ key: 'date', dir: ETableSortDir.DESC })

  function onAdd(): void {
    startTransition(async () => {
      const result = await addTrackedDomain(host)
      if (result.ok) {
        setHost('')
      } else {
        const known = ADD_ERROR_KEY[result.error]
        if (known !== undefined) {
          notify.warning(t(known))
        } else {
          notify.error(t('siteAddError'))
        }
      }
    })
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = sites.filter((s) => q === '' || s.host.includes(q))
    const factor = sort.dir === ETableSortDir.ASC ? 1 : -1
    return filtered.toSorted((a, b) => {
      if (sort.key === 'score') {
        return ((a.overall ?? -1) - (b.overall ?? -1)) * factor
      }
      const aTime = a.lastScanAt === null ? 0 : Date.parse(a.lastScanAt)
      const bTime = b.lastScanAt === null ? 0 : Date.parse(b.lastScanAt)
      return (aTime - bTime) * factor
    })
  }, [sites, query, sort])

  const columns: Array<IDataTableColumn<ISiteRow>> = [
    {
      key: 'host',
      header: t('colSite'),
      render: (row) => <span className="text-site-text truncate font-medium">{row.host}</span>,
    },
    {
      key: 'status',
      header: t('colStatus'),
      render: (row) => (
        <StatusChip
          on={row.verifiedAt !== null}
          onLabel={t('siteVerified')}
          offLabel={t('siteUnverified')}
        />
      ),
    },
    {
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
            emptyLabel: t('siteNeverScanned'),
          }}
        />
      ),
    },
    {
      key: 'monitoring',
      header: t('colMonitoring'),
      render: (row) => (
        <StatusChip
          on={row.monitoringEnabled}
          onLabel={t('siteMonitoringOn')}
          offLabel={t('siteMonitoringOff')}
        />
      ),
    },
    {
      key: 'date',
      header: t('colNextCheck'),
      sortable: true,
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

  const filtering = query.trim() !== ''
  const state =
    visible.length > 0
      ? ETableState.IDLE
      : filtering
        ? ETableState.FILTERED_EMPTY
        : ETableState.EMPTY

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {canAddMore ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TextInput
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder={t('domainPlaceholder')}
            aria-label={t('domainPlaceholder')}
            surface="subtle"
          />
          <Button
            variant={EButtonVariant.PRIMARY}
            onPress={onAdd}
            isDisabled={pending || host.trim().length === 0}
            className="shrink-0"
          >
            {t('siteAdd')}
          </Button>
        </div>
      ) : (
        <p className="text-site-muted text-sm">{t('siteQuota')}</p>
      )}
      <div className="flex justify-end">
        <span className="text-site-faint font-mono text-xs">
          {t('sitesQuota', { used: sites.length, limit })}
        </span>
      </div>

      {sites.length > 0 ? (
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('scansSearch')}
          aria-label={t('scansSearch')}
          surface="subtle"
        />
      ) : null}

      <DataTable
        fill
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/dashboard/websites/${row.id}`)}
        sort={sort}
        onSortChange={setSort}
        state={state}
        emptyState={<EmptyState title={t('sitesEmpty')} />}
        filteredEmptyState={<EmptyState title={t('scansFilteredEmpty')} />}
      />
    </div>
  )
}

// MARK: - Cells

function StatusChip({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap ${
        on ? 'border-site-accent/45 text-site-accent' : 'border-site-border text-site-faint'
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  )
}
