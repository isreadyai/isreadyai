'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { EMAIL_REPORT_INPUT_ID } from '@/lib/email-capture'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'

// MARK: - Email-gated report delivery

type TPhase = 'idle' | 'sending' | 'sent' | 'error' | 'unconfigured'

export function EmailReportForm({ id }: { id: string }) {
  const t = useTranslations('report')

  const [phase, setPhase] = useState<TPhase>('idle')
  const [email, setEmail] = useState('')

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setPhase('sending')
    try {
      const response = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, email }),
      })
      if (response.status === 503) {
        setPhase('unconfigured')
        return
      }
      setPhase(response.ok ? 'sent' : 'error')
    } catch {
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
        <Button type="submit" variant="primary" isDisabled={phase === 'sending'}>
          {phase === 'sending' ? t('emailSending') : t('emailCta')}
        </Button>
      </div>
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
