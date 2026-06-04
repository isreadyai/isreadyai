'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { notify } from '@/components/ui/toast'
import { setMonitoringSmartAgent } from '@/lib/actions/domains'

// MARK: - Smart Agent readability switch (monitoring, Pro)

type TSmartToggle = 'on' | 'off'

/** Smart Agent monitoring toggle (Pro feature). */
export function SmartAgentSwitch({
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
  const [value, setValue] = useState<TSmartToggle>(enabled ? 'on' : 'off')

  function onChange(next: TSmartToggle): void {
    if (next === value) return
    if (!premium) {
      notify.warning(t('siteMonitorUpgrade'))
      return
    }
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await setMonitoringSmartAgent(siteId, next === 'on')
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
      <span className="text-site-faint text-sm">{t('siteSmartAgentLabel')}</span>
      <SegmentedControl
        value={value}
        options={[
          { value: 'on', label: t('siteSmartAgentOn') },
          { value: 'off', label: t('siteSmartAgentOff') },
        ]}
        onChange={onChange}
        ariaLabel={t('siteSmartAgentLabel')}
      />
    </div>
  )
}
