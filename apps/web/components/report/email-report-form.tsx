'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { EMAIL_REPORT_INPUT_ID } from '@/lib/email-capture'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile'

// MARK: - Email-gated report delivery

type TPhase = 'idle' | 'sending' | 'sent' | 'error' | 'unconfigured'

export function EmailReportForm({ id }: { id: string }) {
  const t = useTranslations('report')

  const [phase, setPhase] = useState<TPhase>('idle')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)

  const captchaOn = TURNSTILE_SITE_KEY !== ''

  function recycleCaptcha(): void {
    setToken(null)
    setResetSignal((value) => value + 1)
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setPhase('sending')
    try {
      const response = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, email, turnstileToken: token ?? undefined }),
      })
      // Turnstile tokens are single-use; force a fresh widget for any retry.
      recycleCaptcha()
      if (response.status === 503) {
        setPhase('unconfigured')
        return
      }
      setPhase(response.ok ? 'sent' : 'error')
    } catch {
      recycleCaptcha()
      setPhase('error')
    }
  }

  if (phase === 'sent') {
    return <output className="text-score-excellent mt-4 text-sm">✓ {t('emailSent')}</output>
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          id={EMAIL_REPORT_INPUT_ID}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          aria-label={t('emailPlaceholder')}
          disabled={phase === 'sending'}
          surface="subtle"
          className="flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          isDisabled={phase === 'sending' || (captchaOn && token === null)}
        >
          {phase === 'sending' ? t('emailSending') : t('emailCta')}
        </Button>
      </div>
      {captchaOn ? (
        <div className="mt-3">
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onToken={setToken}
            resetSignal={resetSignal}
          />
        </div>
      ) : null}
      {phase === 'error' ? (
        <p className="text-danger mt-2 text-sm" role="alert">
          {t('emailError')}
        </p>
      ) : phase === 'unconfigured' ? (
        <p className="text-warning mt-2 text-sm" role="alert">
          {t('emailUnavailable')}
        </p>
      ) : (
        <p className="text-site-faint mt-2 text-xs">{t('emailPrivacy')}</p>
      )}
    </form>
  )
}
