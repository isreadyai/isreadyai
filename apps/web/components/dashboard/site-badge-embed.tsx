'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { notify } from '@/components/ui/toast'
import { setBadgeEnabled } from '@/lib/actions/domains'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'

// MARK: - Site badge embed (Pro/Team feature, owner-activated)
//
// The live badge is served for a VERIFIED domain only when the owner is on a paid
// plan AND has activated it (websites.badge_enabled). The owner toggles activation
// here; the snippet shows only once it's verified + premium + active.

export function SiteBadgeEmbed({
  siteId,
  host,
  verified,
  premium,
  enabled,
  siteUrl,
}: {
  siteId: string
  host: string
  verified: boolean
  premium: boolean
  enabled: boolean
  siteUrl: string
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const { copied, copy } = useCopyToClipboard(2000)
  const [, startTransition] = useTransition()
  const [on, setOn] = useState(enabled)

  const badgeUrl = `${siteUrl}/badge/${host}`
  const markdown = `[![AI readiness](${badgeUrl})](${siteUrl})`
  const active = premium && verified && on

  function onToggle(next: 'on' | 'off'): void {
    const wantOn = next === 'on'
    if (wantOn === on) {
      return
    }
    const previous = on
    setOn(wantOn)
    startTransition(async () => {
      const result = await setBadgeEnabled(siteId, wantOn)
      if (!result.ok) {
        setOn(previous)
        notify.error(
          t(result.error === 'verification_required' ? 'siteBadgeVerifyFirst' : 'siteAddError'),
        )
      } else {
        router.refresh()
      }
    })
  }

  const hint = !premium
    ? t('siteBadgePremium')
    : !verified
      ? t('siteBadgeUnverified')
      : t('siteBadgeHint')

  return (
    <section className="border-site-border bg-site-surface/50 space-y-4 rounded-2xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{t('siteBadgeTitle')}</h2>
          <p className="text-site-muted mt-1 text-xs">{hint}</p>
        </div>
        {!premium ? (
          <Button variant="secondary" href="/pricing" className="shrink-0">
            {t('siteBadgeUpgrade')}
          </Button>
        ) : verified ? (
          <SegmentedControl
            value={on ? 'on' : 'off'}
            options={[
              { value: 'on', label: t('siteSmartAgentOn') },
              { value: 'off', label: t('siteSmartAgentOff') },
            ]}
            onChange={onToggle}
            ariaLabel={t('siteBadgeTitle')}
          />
        ) : null}
      </div>
      {active ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- external SVG badge endpoint */}
          <img
            src={badgeUrl}
            alt={`AI readiness badge for ${host}`}
            height={20}
            className="h-5 w-auto"
          />
          <div className="flex items-center gap-2">
            <code className="border-site-border bg-site-raised/40 min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-xs">
              {markdown}
            </code>
            <CopyButton
              copied={copied !== null}
              onCopy={() => void copy(markdown)}
              copyLabel={t('copy')}
              copiedLabel={t('copied')}
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
