'use client'

import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { notify } from '@/components/ui/toast'
import { acceptTerms } from '@/lib/actions/consent'

const renderTermsLink = (chunks: ReactNode) => (
  <Link href="/terms-and-conditions" className="text-site-secondary hover:text-site-text underline">
    {chunks}
  </Link>
)

const renderPrivacyLink = (chunks: ReactNode) => (
  <Link href="/privacy" className="text-site-secondary hover:text-site-text underline">
    {chunks}
  </Link>
)

/** Consent acceptance form with links to terms and privacy policy. */
export function WelcomeConsent({ next }: { next: string }) {
  const t = useTranslations('welcome')
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!accepted || busy) {
      return
    }
    setBusy(true)
    const result = await acceptTerms()
    if (result.ok) {
      // replace (not push) so the gate page never sits in history behind the app.
      router.replace(next)
      return
    }
    setBusy(false)
    notify.error(t('error'))
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-8">
      <label className="text-site-muted flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="border-site-border accent-site-accent mt-0.5 size-4 shrink-0 rounded"
        />
        <span>
          {t.rich('consentLabel', { terms: renderTermsLink, privacy: renderPrivacyLink })}
        </span>
      </label>

      <p className="text-site-faint mt-2 text-xs leading-relaxed">{t('consentHint')}</p>

      <Button
        variant="primary"
        type="submit"
        isDisabled={!accepted || busy}
        className="mt-6 w-full"
      >
        {busy ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}
