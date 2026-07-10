'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  readAnalyticsConsent,
  type TAnalyticsConsent,
  writeAnalyticsConsent,
} from '@/lib/analytics-consent'

// MARK: - Cookie consent (Google Consent Mode v2)

const REOPEN_EVENT = 'open-cookie-consent'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

// Consent defaults are set to 'denied' before GTM loads (inline script in the
// root layout); this only flips analytics/ads to the visitor's choice.
function updateConsent(choice: TAnalyticsConsent): void {
  window.gtag?.('consent', 'update', {
    analytics_storage: choice,
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
  })
}

/** Footer entry point to re-open the banner after a choice was made. */
export function CookiePreferencesLink({ className }: { className?: string }) {
  const t = useTranslations('footer')
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(REOPEN_EVENT))}
    >
      {t('cookies')}
    </button>
  )
}

/**
 * GDPR cookie banner wired to Consent Mode v2. Shows once until a choice is
 * stored; re-openable from the footer via the REOPEN_EVENT. Accept grants
 * analytics + ads storage, Reject leaves the denied defaults in place.
 */
export function CookieConsent() {
  const t = useTranslations('cookies')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored = readAnalyticsConsent()
    if (stored === 'granted') {
      updateConsent('granted')
    } else if (stored === null) {
      setOpen(true)
    }
    const reopen = () => setOpen(true)
    window.addEventListener(REOPEN_EVENT, reopen)
    return () => window.removeEventListener(REOPEN_EVENT, reopen)
  }, [])

  function choose(choice: TAnalyticsConsent): void {
    writeAnalyticsConsent(choice)
    updateConsent(choice)
    setOpen(false)
  }

  if (!open) {
    return null
  }
  return (
    <aside
      aria-label={t('title')}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-site-border bg-site-background/95 p-4 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[28rem]"
    >
      <p className="text-site-muted text-sm">
        {t('body')}{' '}
        <Link href="/privacy" className="text-site-text underline underline-offset-2">
          {t('privacy')}
        </Link>{' '}
        ·{' '}
        <Link href="/terms-and-conditions" className="text-site-text underline underline-offset-2">
          {t('terms')}
        </Link>
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => choose('denied')}
          className="text-site-muted hover:text-site-text rounded-lg px-3 py-1.5 text-sm transition-colors"
        >
          {t('reject')}
        </button>
        <button
          type="button"
          onClick={() => choose('granted')}
          className="bg-site-accent text-site-background rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          {t('accept')}
        </button>
      </div>
    </aside>
  )
}
