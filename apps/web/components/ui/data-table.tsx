'use client'

import { Skeleton } from '@heroui/react/skeleton'
import Link from 'next/link'
import type { KeyboardEvent, ReactNode } from 'react'

// MARK: - DataTable (semantic <table>; sortable, keyboard rows, lifecycle states)

/**
 * Hand-rolled <table> rather than HeroUI's Table: HeroUI's Table renders a
 * react-aria role="grid" of <div>s with its own collection/sortDescriptor API,
 * which doesn't map onto a plain columns[]+rows[] contract and can't expose
 * native <th scope> / aria-sort. A semantic table gives correct table semantics
 * with far less code; we still borrow HeroUI's Skeleton for loading rows.
 */

export const ETableSortDir = {
  ASC: 'asc',
  DESC: 'desc',
} as const
export type TTableSortDir = (typeof ETableSortDir)[keyof typeof ETableSortDir]

export const ETableState = {
  IDLE: 'idle',
  LOADING: 'loading',
  EMPTY: 'empty',
  FILTERED_EMPTY: 'filtered-empty',
  ERROR: 'error',
} as const
export type TTableState = (typeof ETableState)[keyof typeof ETableState]

export const ETableAlign = {
  START: 'start',
  CENTER: 'center',
  END: 'end',
} as const
export type TTableAlign = (typeof ETableAlign)[keyof typeof ETableAlign]

export interface IDataTableColumn<T> {
  key: string
  header: ReactNode
  sortable?: boolean
  align?: TTableAlign
  render?: (row: T) => ReactNode
  className?: string
}

export interface IDataTableSort {
  key: string
  dir: TTableSortDir
}

interface IDataTableProps<T> {
  columns: Array<IDataTableColumn<T>>
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  sort?: IDataTableSort
  onSortChange?: (sort: IDataTableSort) => void
  state?: TTableState
  emptyState?: ReactNode
  filteredEmptyState?: ReactNode
  errorState?: ReactNode
  loadingRowCount?: number
  className?: string
  /** Grow to fill the remaining vertical space (min-height floor); the body
   * scrolls internally with a sticky header. The parent must be a flex column. */
  fill?: boolean
}

const ALIGN_CLASS: Record<TTableAlign, string> = {
  [ETableAlign.START]: 'text-left',
  [ETableAlign.CENTER]: 'text-center',
  [ETableAlign.END]: 'text-right',
}

// aria-sort reflects the column's current state for assistive tech; non-active
// sortable columns advertise themselves as sortable via 'none'.
function ariaSortFor(column: IDataTableColumn<unknown>, sort?: IDataTableSort) {
  if (column.sortable !== true) return undefined
  if (sort?.key !== column.key) return 'none' as const
  return sort.dir === ETableSortDir.ASC ? ('ascending' as const) : ('descending' as const)
}

function nextSort(column: { key: string }, sort?: IDataTableSort): IDataTableSort {
  if (sort?.key === column.key && sort.dir === ETableSortDir.ASC) {
    return { key: column.key, dir: ETableSortDir.DESC }
  }
  return { key: column.key, dir: ETableSortDir.ASC }
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  sort,
  onSortChange,
  state = ETableState.IDLE,
  emptyState,
  filteredEmptyState,
  errorState,
  loadingRowCount = 6,
  className = '',
  fill = false,
}: IDataTableProps<T>) {
  const isInteractive = onRowClick !== undefined

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick?.(row)
    }
  }

  const slot =
    state === ETableState.ERROR
      ? errorState
      : state === ETableState.FILTERED_EMPTY
        ? filteredEmptyState
        : state === ETableState.EMPTY
          ? emptyState
          : null

  const showSlot = state !== ETableState.LOADING && state !== ETableState.IDLE && slot !== null

  return (
    <div
      className={`border-site-border bg-site-surface w-full min-w-0 max-w-full overflow-hidden rounded-2xl border ${
        fill ? 'flex min-h-[18rem] flex-1 flex-col' : ''
      } ${className}`}
    >
      <div className={fill ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto'}>
        <table className="w-full border-collapse text-sm">
          <thead className={fill ? 'sticky top-0 z-10' : ''}>
            <tr className="border-site-border border-b">
              {columns.map((column) => {
                const align = column.align ?? ETableAlign.START
                const ariaSort = ariaSortFor(column as IDataTableColumn<unknown>, sort)
                const isActive = sort?.key === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`text-site-muted px-4 py-3 text-xs font-medium tracking-wide uppercase ${ALIGN_CLASS[align]} ${fill ? 'bg-site-surface' : ''} ${column.className ?? ''}`}
                  >
                    {column.sortable === true ? (
                      <button
                        type="button"
                        onClick={() => onSortChange?.(nextSort(column, sort))}
                        className={`hover:text-site-text inline-flex cursor-pointer items-center gap-1 transition-colors ${isActive ? 'text-site-text' : ''}`}
                      >
                        {column.header}
                        <span aria-hidden className="text-site-faint text-[0.65rem]">
                          {isActive ? (sort?.dir === ETableSortDir.ASC ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {state === ETableState.LOADING ? (
              Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows are positional and static
                // eslint-disable-next-line react/no-array-index-key -- skeleton placeholder rows, no stable id
                <tr key={rowIndex} className="border-site-border/60 border-b last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3.5">
                      <Skeleton className="bg-site-raised h-4 w-full max-w-32 rounded-md" />
                    </td>
                  ))}
                </tr>
              ))
            ) : showSlot ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  {slot}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={isInteractive ? () => onRowClick?.(row) : undefined}
                  onKeyDown={isInteractive ? (event) => handleRowKeyDown(event, row) : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  role={isInteractive ? 'button' : undefined}
                  className={`border-site-border/60 border-b last:border-0 ${
                    isInteractive
                      ? 'hover:bg-site-raised focus-visible:bg-site-raised cursor-pointer outline-none transition-colors'
                      : ''
                  }`}
                >
                  {columns.map((column) => {
                    const align = column.align ?? ETableAlign.START
                    return (
                      <td
                        key={column.key}
                        className={`text-site-text px-4 py-3.5 ${ALIGN_CLASS[align]} ${column.className ?? ''}`}
                      >
                        {column.render ? column.render(row) : null}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// MARK: - Row actions cell
//
// The trailing actions column: squared outline icon buttons (pass via children),
// always ending in a chevron that opens the row's detail. Clicks here don't
// bubble to the row, so per-row actions never trigger row navigation.

export function RowActions({
  detailHref,
  openLabel,
  children,
}: {
  detailHref: string
  openLabel: string
  children?: ReactNode
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: container only stops bubbling
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- container only stops click bubbling; keyboard nav handled by parent row
    <div
      className="flex items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      <Link
        href={detailHref}
        aria-label={openLabel}
        className="border-site-border text-site-muted hover:border-site-accent-dim hover:text-site-text flex size-8 items-center justify-center rounded-lg border transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  )
}

// MARK: - Squared outline icon button (for RowActions children)

export function RowActionButton({
  icon,
  label,
  href,
  onPress,
  tone = 'neutral',
}: {
  icon: ReactNode
  label: string
  href?: string
  onPress?: () => void
  tone?: 'neutral' | 'danger'
}) {
  const cls = `flex size-8 items-center justify-center rounded-lg border transition-colors ${
    tone === 'danger'
      ? 'border-site-border text-site-muted hover:border-danger hover:text-danger'
      : 'border-site-border text-site-muted hover:border-site-accent-dim hover:text-site-text'
  }`
  if (href !== undefined) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {icon}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} onClick={onPress} className={cls}>
      {icon}
    </button>
  )
}
