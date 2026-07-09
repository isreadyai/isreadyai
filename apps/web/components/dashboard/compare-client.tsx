'use client'

import { Card } from '@heroui/react/card'
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/empty-state'
import { dayjs } from '@/lib/dayjs'
import { useBrowserTimeZone } from '@/lib/use-browser-time-zone'

// MARK: - Compare

export interface ICompareScan {
  id: string
  host: string
  createdAt: string
  overall: number
  categories: Array<{ key: string; label: string; score: number }>
  findings: Array<{ id: string; title: string; status: string }>
}

/** Scan comparison UI: select host and two scans, view delta on score and findings. */
export function CompareClient({ scans }: { scans: ICompareScan[] }) {
  const t = useTranslations('dashboard')
  const timeZone = useBrowserTimeZone()

  const hosts = useMemo(() => [...new Set(scans.map((s) => s.host))].toSorted(), [scans])
  const [host, setHost] = useState(hosts[0] ?? '')
  const forHost = useMemo(
    () =>
      scans
        .filter((s) => s.host === host)
        .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [scans, host],
  )
  const [bId, setBId] = useState('')
  const [aId, setAId] = useState('')

  // Default to the two most recent scans of the selected host.
  const newer = forHost.find((s) => s.id === bId) ?? forHost[0] ?? null
  const older = forHost.find((s) => s.id === aId) ?? forHost[1] ?? null

  if (scans.length < 2) {
    return <EmptyState title={t('compareEmptyTitle')} description={t('compareEmptyBody')} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          label={t('compareHost')}
          value={host}
          onChange={setHost}
          options={hosts.map((h) => ({ value: h, label: h }))}
        />
        <Select
          label={t('compareNewer')}
          value={newer?.id ?? ''}
          onChange={setBId}
          options={forHost.map((s) => ({
            value: s.id,
            label: dayjs
              .utc(s.createdAt)
              .tz(timeZone ?? 'UTC')
              .format('DD/MM/YYYY, HH:mm:ss'),
          }))}
        />
        <Select
          label={t('compareOlder')}
          value={older?.id ?? ''}
          onChange={setAId}
          options={forHost.map((s) => ({
            value: s.id,
            label: dayjs
              .utc(s.createdAt)
              .tz(timeZone ?? 'UTC')
              .format('DD/MM/YYYY, HH:mm:ss'),
          }))}
        />
      </div>

      {newer !== null && older !== null && newer.id !== older.id ? (
        <Diff older={older} newer={newer} />
      ) : (
        <EmptyState title={t('compareNeedTwo')} />
      )}
    </div>
  )
}

// MARK: - Diff

function isProblem(status: string | undefined): boolean {
  return status === 'fail' || status === 'warn'
}

function Diff({ older, newer }: { older: ICompareScan; newer: ICompareScan }) {
  const t = useTranslations('dashboard')
  const overallDelta = newer.overall - older.overall

  const olderStatus = new Map(older.findings.map((f) => [f.id, f.status]))
  const newerStatus = new Map(newer.findings.map((f) => [f.id, f.status]))

  const resolved = newer.findings.filter(
    (f) => !isProblem(newerStatus.get(f.id)) && isProblem(olderStatus.get(f.id)),
  )
  const regressed = newer.findings.filter(
    (f) => isProblem(f.status) && !isProblem(olderStatus.get(f.id)) && olderStatus.has(f.id),
  )
  const added = newer.findings.filter((f) => isProblem(f.status) && !olderStatus.has(f.id))

  return (
    <div className="space-y-6">
      <Card className="border-site-border bg-site-surface/60 border">
        <Card.Content className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold">{newer.overall}</span>
            <DeltaBadge delta={overallDelta} />
            <span className="text-site-faint text-xs">
              {t('compareWas', { score: older.overall })}
            </span>
          </div>
          <ul className="space-y-2">
            {newer.categories.map((cat) => {
              const prev = older.categories.find((c) => c.key === cat.key)
              const delta = prev !== undefined ? cat.score - prev.score : 0
              return (
                <li key={cat.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-site-muted truncate">{cat.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono">{cat.score}</span>
                    <DeltaBadge delta={delta} small />
                  </span>
                </li>
              )
            })}
          </ul>
        </Card.Content>
      </Card>

      <FindingGroup
        title={t('compareResolved', { count: resolved.length })}
        items={resolved}
        tone="text-score-excellent"
      />
      <FindingGroup
        title={t('compareRegressed', { count: regressed.length })}
        items={regressed}
        tone="text-score-poor"
      />
      <FindingGroup
        title={t('compareAdded', { count: added.length })}
        items={added}
        tone="text-score-moderate"
      />
    </div>
  )
}

function FindingGroup({
  title,
  items,
  tone,
}: {
  title: string
  items: Array<{ id: string; title: string }>
  tone: string
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <Card className="border-site-border bg-site-surface/60 border">
      <Card.Content className="space-y-2">
        <p className={`text-sm font-semibold ${tone}`}>{title}</p>
        <ul className="space-y-1">
          {items.map((f) => (
            <li key={f.id} className="text-site-muted text-sm">
              {f.title}
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  )
}

function DeltaBadge({ delta, small = false }: { delta: number; small?: boolean }) {
  const tone =
    delta > 0 ? 'text-score-excellent' : delta < 0 ? 'text-score-poor' : 'text-site-faint'
  const sign = delta > 0 ? '+' : ''
  return (
    <span className={`font-mono ${small ? 'text-xs' : 'text-sm'} ${tone}`}>
      {delta === 0 ? '±0' : `${sign}${delta}`}
    </span>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-site-faint text-xs">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-site-border bg-site-surface min-h-11 rounded-xl border px-4 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
