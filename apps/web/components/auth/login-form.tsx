'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { GitHubIcon } from '@/components/ui/github-icon'
import { GoogleIcon } from '@/components/ui/google-icon'
import { XIcon } from '@/components/ui/x-icon'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'
import { notify } from '@/components/ui/toast'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile'
import { safeNext } from '@/lib/safe-next'
import type { TOAuthProvider } from '@/lib/oauth-providers'

type TStage = 'email' | 'signup'

const INPUT_CLASS =
  'border-site-border bg-site-background text-site-text placeholder:text-site-faint focus:border-site-secondary min-h-11 w-full rounded-xl border px-3 text-sm outline-none'

// Supabase returns this when shouldCreateUser is false and the address is new.
function isUnknownUser(error: { code?: string; message: string }): boolean {
  return error.code === 'otp_disabled' || /signups?\s+not\s+allowed/i.test(error.message)
}

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

/** Multi-stage login form with OAuth and magic-link options. */
export function LoginForm() {
  const t = useTranslations('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [stage, setStage] = useState<TStage>('email')
  const [busy, setBusy] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)

  // Carry a same-site ?redirect through auth as ?next; safeNext drops off-site
  // values and the callback re-checks.
  const redirectTo =
    typeof window === 'undefined'
      ? undefined
      : (() => {
          const base = `${window.location.origin}/auth/callback`
          const redirect = new URLSearchParams(window.location.search).get('redirect')
          return redirect !== null && safeNext(redirect) === redirect
            ? `${base}?next=${encodeURIComponent(redirect)}`
            : base
        })()

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const code = hash.get('error_code')
    if (hash.get('error') === null && code === null) {
      return
    }
    notify.error(code === 'otp_expired' ? t('linkExpired') : t('error'))
    window.history.replaceState(null, '', window.location.pathname)
  }, [t])

  async function signInWith(provider: TOAuthProvider): Promise<void> {
    setBusy(true)
    // createBrowserSupabaseClient throws when the publishable env is missing —
    // catch it so an unconfigured deploy surfaces the error instead of crashing.
    try {
      const supabase = createBrowserSupabaseClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (oauthError !== null) {
        logger.error('[login] OAuth sign-in failed', oauthError)
        notify.error(t('error'))
        setBusy(false)
      }
    } catch (cause) {
      logger.error('[login] Supabase client unavailable (check NEXT_PUBLIC_SUPABASE_*)', cause)
      notify.error(t('error'))
      setBusy(false)
    }
  }

  // Turnstile tokens are single-use; consuming one means the next call needs a fresh widget.
  function recycleCaptcha(): void {
    setCaptchaToken(null)
    setCaptchaReset((value) => value + 1)
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const address = email.trim()
    if (address.length === 0 || busy) {
      return
    }
    if (stage === 'signup' && !accepted) {
      // Missing consent is a form-validation prompt, not an error.
      notify.warning(t('termsRequired'))
      return
    }

    setBusy(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const isSignup = stage === 'signup'
      // The server enforces the captcha; the client only attaches a token when it
      // has one, so a missing/loading widget never blocks the request.
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: isSignup,
          ...(captchaToken !== null ? { captchaToken } : {}),
          ...(isSignup
            ? { data: { display_name: name.trim(), terms_accepted_at: new Date().toISOString() } }
            : {}),
        },
      })
      setBusy(false)
      recycleCaptcha()
      if (error === null) {
        notify.success(t('sent'))
        return
      }
      if (!isSignup && isUnknownUser(error)) {
        setStage('signup')
        notify.info(t('newAccount'))
        return
      }
      logger.error('[login] magic-link send failed', error)
      if (/captcha/i.test(error.message)) {
        // The user can simply complete the captcha and retry — not a hard failure.
        notify.warning(t('captchaRequired'))
      } else {
        notify.error(t('error'))
      }
    } catch (cause) {
      logger.error('[login] Supabase client unavailable (check NEXT_PUBLIC_SUPABASE_*)', cause)
      setBusy(false)
      recycleCaptcha()
      notify.error(t('error'))
    }
  }

  const isSignup = stage === 'signup'

  return (
    <div className="border-site-border bg-site-surface/60 w-full max-w-sm rounded-2xl border p-7 shadow-2xl">
      <p className="text-site-secondary font-mono text-xs tracking-wide uppercase">{t('kicker')}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-site-muted mt-2 text-sm leading-relaxed">{t('subtitle')}</p>

      <div className="mt-6 flex flex-col gap-3">
        <Button
          appearance="outline"
          onPress={() => void signInWith('github')}
          isDisabled={busy}
          className="w-full"
        >
          <GitHubIcon className="size-[18px]" />
          {t('github')}
        </Button>
        <Button
          appearance="outline"
          onPress={() => void signInWith('google')}
          isDisabled={busy}
          className="w-full"
        >
          <GoogleIcon className="size-[18px]" />
          {t('google')}
        </Button>
        <Button
          appearance="outline"
          onPress={() => void signInWith('x')}
          isDisabled={busy}
          className="w-full"
        >
          <XIcon className="size-4" />
          {t('x')}
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="bg-site-border h-px flex-1" />
        <span className="text-site-faint text-xs">{t('or')}</span>
        <span className="bg-site-border h-px flex-1" />
      </div>

      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('emailPlaceholder')}
          aria-label={t('emailLabel')}
          autoComplete="email"
          className={INPUT_CLASS}
        />

        {isSignup ? (
          <>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('displayNamePlaceholder')}
              aria-label={t('displayNameLabel')}
              autoComplete="name"
              className={INPUT_CLASS}
            />
            <label className="text-site-muted flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="border-site-border accent-site-accent mt-0.5 size-4 shrink-0 rounded"
              />
              <span>{t.rich('terms', { terms: renderTermsLink, privacy: renderPrivacyLink })}</span>
            </label>
          </>
        ) : null}

        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          onToken={setCaptchaToken}
          resetSignal={captchaReset}
        />

        <Button variant="primary" type="submit" isDisabled={busy} className="w-full">
          {busy ? t('sending') : isSignup ? t('createAccount') : t('magicLink')}
        </Button>
      </form>
    </div>
  )
}
