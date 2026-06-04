'use client'

import type { TScanMode } from '@/lib/actions/domains'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { notify } from '@/components/ui/toast'
import { setMonitoringScanMode } from '@/lib/actions/domains'

// MARK: - Scan depth switch

/** Toggles between simple and deep automated scan modes (premium feature). */
export function MonitoringModeSwitch({
  siteId,
  mode,
  premium,
}: {
  siteId: string
  mode: TScanMode
  premium: boolean
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState<TScanMode>(mode)

  function onChange(next: TScanMode): void {
    if (next === value) return
    if (!premium) {
      notify.warning(t('siteMonitorUpgrade'))
      return
    }
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await setMonitoringScanMode(siteId, next)
      if (!result.ok) {
        setValue(previous)
        notify.error(t('siteAddError'))
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-site-faint text-sm">{t('siteScanModeLabel')}</span>
      <SegmentedControl
        value={value}
        options={[
          { value: 'simple', label: t('siteScanModeSimple') },
          { value: 'deep', label: t('siteScanModeDeep') },
        ]}
        onChange={onChange}
        ariaLabel={t('siteScanModeLabel')}
      />
    </div>
  )
}
