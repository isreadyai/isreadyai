'use client'

import { Card } from '@heroui/react/card'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

// MARK: - Inline guest → account registration before checkout (passwordless)

/** Guest-to-account signup form before checkout (passwordless). */
export function CheckoutSignup({ plan }: { plan: 'pro' | 'team' }) {
  const t = useTranslations('checkout')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [terms, setTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loginHref = `/login?redirect=${encodeURIComponent(`/checkout?plan=${plan}`)}`

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!terms) {
      setError(t('termsRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    const supabase = createBrowserSupabaseClient()
    // Attaches an email to the anonymous user → upgrades it to a real account,
    // preserving its guest scans. No password (magic-link for future logins).
    const { error: err } = await supabase.auth.updateUser({
      email: email.trim(),
      data: { display_name: name.trim() },
    })
    if (err !== null) {
      // The email already belongs to an account: log in, then back to checkout.
      window.location.href = loginHref
      return
    }
    // Email set → re-enter /checkout, which now proceeds straight to Stripe.
    window.location.href = `/checkout?plan=${plan}`
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-16">
      <Card className="border-site-border bg-site-surface/60 border">
        <Card.Content className="space-y-5">
          <div>
            <p className="text-site-secondary font-mono text-xs tracking-wide uppercase">
              {t('kicker', { plan: t(`plan.${plan}`) })}
            </p>
            <h1 className="mt-2 text-xl font-semibold">{t('title')}</h1>
            <p className="text-site-muted mt-1 text-sm">{t('subtitle')}</p>
          </div>

          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              aria-label={t('emailPlaceholder')}
              required
              surface="subtle"
            />
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              aria-label={t('namePlaceholder')}
              required
              surface="subtle"
            />
            <label className="text-site-muted flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="accent-site-accent mt-0.5"
              />
              <span>
                {t('terms')}{' '}
                <Link href="/terms-and-conditions" className="text-site-accent hover:underline">
                  {t('termsLink')}
                </Link>{' '}
                ·{' '}
                <Link href="/privacy" className="text-site-accent hover:underline">
                  {t('privacyLink')}
                </Link>
              </span>
            </label>
            {error !== null ? (
              <p className="text-danger text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" isDisabled={submitting} className="w-full">
              {submitting ? t('submitting') : t('continue')}
            </Button>
          </form>

          <p className="text-site-faint text-center text-xs">
            {t('haveAccount')}{' '}
            <a href={loginHref} className="text-site-accent hover:underline">
              {t('login')}
            </a>
          </p>
        </Card.Content>
      </Card>
    </main>
  )
}
