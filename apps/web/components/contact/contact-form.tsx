'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TextInput } from '@/components/ui/text-input'
import { Button, EButtonVariant } from '@/components/ui/button'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile'

// MARK: - Contact / feedback / fraud-report form

type TReason = 'feedback' | 'bug' | 'fraud' | 'other'
type TPhase = 'idle' | 'sending' | 'sent' | 'error' | 'unconfigured'

const REASONS: readonly TReason[] = ['feedback', 'bug', 'fraud', 'other']

const FIELD_CLASS =
  'border-site-border bg-site-surface placeholder:text-site-faint w-full rounded-xl border px-4 text-sm outline-none'

export function ContactForm({
  initialReason = 'feedback',
  initialHost = '',
}: {
  initialReason?: TReason
  initialHost?: string
}) {
  const t = useTranslations('contact')
  const [phase, setPhase] = useState<TPhase>('idle')
  const [reason, setReason] = useState<TReason>(initialReason)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [host, setHost] = useState(initialHost)
  const [message, setMessage] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)

  const captchaOn = TURNSTILE_SITE_KEY !== ''
  const busy = phase === 'sending'

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setPhase('sending')
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reason,
          email,
          name: name.trim() === '' ? undefined : name.trim(),
          host: reason === 'fraud' && host.trim() !== '' ? host.trim() : undefined,
          message,
          turnstileToken: token ?? undefined,
        }),
      })
      if (response.status === 503) {
        setPhase('unconfigured')
        return
      }
      if (!response.ok) {
        setPhase('error')
        setResetSignal((n) => n + 1)
        return
      }
      setPhase('sent')
    } catch {
      setPhase('error')
      setResetSignal((n) => n + 1)
    }
  }

  if (phase === 'sent') {
    return (
      <output className="border-site-border bg-site-surface/50 mt-8 block rounded-2xl border p-6 text-center">
        <p className="text-score-excellent text-sm font-medium">✓ {t('successTitle')}</p>
        <p className="text-site-muted mt-1 text-sm">{t('successBody')}</p>
      </output>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-8 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-site-muted text-xs">{t('nameLabel')}</span>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-site-muted text-xs">{t('emailLabel')}</span>
          <TextInput
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailPlaceholder')}
            disabled={busy}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-site-muted text-xs">{t('reasonLabel')}</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as TReason)}
          disabled={busy}
          className={`${FIELD_CLASS} min-h-12`}
        >
          {REASONS.map((value) => (
            <option key={value} value={value}>
              {t(`reason.${value}`)}
            </option>
          ))}
        </select>
      </label>

      {reason === 'fraud' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-site-muted text-xs">{t('hostLabel')}</span>
          <TextInput
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder={t('hostPlaceholder')}
            disabled={busy}
          />
          <span className="text-site-faint text-xs">{t('hostHint')}</span>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-site-muted text-xs">{t('messageLabel')}</span>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('messagePlaceholder')}
          disabled={busy}
          className={`${FIELD_CLASS} min-h-32 resize-y py-3 leading-relaxed`}
        />
      </label>

      {captchaOn ? (
        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          onToken={setToken}
          resetSignal={resetSignal}
        />
      ) : null}

      {phase === 'error' ? <p className="text-danger text-sm">{t('error')}</p> : null}
      {phase === 'unconfigured' ? (
        <p className="text-site-muted text-sm">{t('unconfigured')}</p>
      ) : null}

      <Button
        type="submit"
        variant={EButtonVariant.PRIMARY}
        isDisabled={busy || (captchaOn && token === null)}
        className="sm:self-start"
      >
        {busy ? t('sending') : t('submit')}
      </Button>
    </form>
  )
}
