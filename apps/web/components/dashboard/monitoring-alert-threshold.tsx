'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { notify } from '@/components/ui/toast'
import { setMonitoringAlertThreshold } from '@/lib/actions/domains'

// MARK: - Absolute score-alert threshold

const PRESETS = [70, 80, 90] as const

/** Per-domain absolute threshold below which a monitored scan alerts ('off' disables it). Premium. */
export function MonitoringAlertThreshold({
  siteId,
  threshold,
  premium,
}: {
  siteId: string
  threshold: number | null
  premium: boolean
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState<number | null>(threshold)

  function onChange(next: string): void {
    const parsed = next === 'off' ? null : Number(next)
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
      const result = await setMonitoringAlertThreshold(siteId, parsed)
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
      <span className="text-site-faint text-sm">{t('siteAlertThresholdLabel')}</span>
      <SegmentedControl
        value={value === null ? 'off' : String(value)}
        options={[
          { value: 'off', label: t('siteAlertThresholdOff') },
          ...PRESETS.map((n) => ({ value: String(n), label: String(n) })),
        ]}
        onChange={onChange}
        ariaLabel={t('siteAlertThresholdLabel')}
      />
    </div>
  )
}
