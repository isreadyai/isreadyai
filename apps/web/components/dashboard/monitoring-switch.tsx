'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { notify } from '@/components/ui/toast'
import { setMonitoring } from '@/lib/actions/domains'

// MARK: - Monitoring switch

type TToggle = 'on' | 'off'

/** Toggles automated site monitoring on/off (premium feature). */
export function MonitoringSwitch({
  siteId,
  enabled,
  premium,
}: {
  siteId: string
  enabled: boolean
  premium: boolean
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState<TToggle>(enabled ? 'on' : 'off')

  function onChange(next: TToggle): void {
    if (next === value) return
    if (!premium) {
      notify.warning(t('siteMonitorUpgrade'))
      return
    }
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await setMonitoring(siteId, next === 'on')
      if (!result.ok) {
        setValue(previous)
        // Turning monitoring on requires a verified domain first.
        notify[result.error === 'verification_required' ? 'warning' : 'error'](
          result.error === 'verification_required'
            ? t('siteMonitorVerifyFirst')
            : t('siteAddError'),
        )
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-site-faint text-sm">{t('siteMonitoringLabel')}</span>
      <SegmentedControl
        value={value}
        options={[
          { value: 'on', label: t('siteSmartAgentOn') },
          { value: 'off', label: t('siteSmartAgentOff') },
        ]}
        onChange={onChange}
        ariaLabel={t('siteMonitoringLabel')}
      />
    </div>
  )
}
