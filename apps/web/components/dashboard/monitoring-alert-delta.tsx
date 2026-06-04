'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { notify } from '@/components/ui/toast'
import { setMonitoringAlertDelta } from '@/lib/actions/domains'

// MARK: - Score-drop alert sensitivity

const PRESETS = [5, 10, 15, 20] as const

/** Per-domain points-drop (vs the previous monitored scan) that fires an alert. Premium. */
export function MonitoringAlertDelta({
  siteId,
  delta,
  premium,
}: {
  siteId: string
  delta: number
  premium: boolean
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState<number>(delta)

  function onChange(next: string): void {
    const parsed = Number(next)
    if (parsed === value) {
      return
    }
    if (!premium) {
      notify.warning(t('siteMonitorUpgrade'))
      return
    }
    const previous = value
    setValue(parsed)
    startTransition(async () => {
      const result = await setMonitoringAlertDelta(siteId, parsed)
      if (result.ok) {
        router.refresh()
      } else {
        setValue(previous)
        notify.error(t('siteAddError'))
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-site-faint text-sm">{t('siteAlertDeltaLabel')}</span>
      <SegmentedControl
        value={String(value)}
        options={PRESETS.map((n) => ({ value: String(n), label: t('siteAlertDeltaPts', { n }) }))}
        onChange={onChange}
        ariaLabel={t('siteAlertDeltaLabel')}
      />
    </div>
  )
}
