'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, EButtonVariant } from '@/components/ui/button'
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { TextInput } from '@/components/ui/text-input'
import { notify } from '@/components/ui/toast'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'
import { deleteAccount, setAlertsEnabled } from '@/lib/actions/account'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile'
import type { TOAuthProvider } from '@/lib/oauth-providers'

// MARK: - Account security (magic-link access, social connections, alerts, delete)

const PROVIDERS: TOAuthProvider[] = ['google', 'github', 'x']
const PROVIDER_LABEL: Record<TOAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  x: 'X',
}

/** Security controls for magic-link access, social logins, alerts, and account deletion. */
export function AccountSecurity({
  email,
  alertsEnabled,
  availableProviders,
}: {
  email: string
  alertsEnabled: boolean
  /** Providers the auth server actually has enabled; others render disabled. */
  availableProviders: TOAuthProvider[]
}) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [sending, setSending] = useState(false)
  // GoTrue enforces a captcha on /otp, so the magic-link send must carry a token.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [linked, setLinked] = useState<Set<TOAuthProvider>>(new Set())
  const [alerts, setAlerts] = useState(alertsEnabled)
  const [deleting, setDeleting] = useState(false)
  const deleteConfirm = useConfirm()

  // Read the user's connected social identities once on mount.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient()
        const { data } = await supabase.auth.getUserIdentities()
        if (!alive || data === null) return
        setLinked(
          new Set(
            data.identities
              .map((i) => i.provider)
              .filter((p): p is TOAuthProvider => (PROVIDERS as string[]).includes(p)),
          ),
        )
      } catch {
        // Auth client unavailable — leave the section in its default state.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function sendAccessLink(): Promise<void> {
    setSending(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          ...(captchaToken !== null ? { captchaToken } : {}),
        },
      })
      notify[error === null ? 'success' : 'error'](
        error === null ? t('accessLinkSent') : t('accessLinkError'),
      )
    } catch {
      notify.error(t('accessLinkError'))
    } finally {
      setSending(false)
      // Turnstile tokens are single-use — recycle the widget for the next send.
      setCaptchaToken(null)
      setCaptchaReset((value) => value + 1)
    }
  }

  async function changeEmail(): Promise<void> {
    const next = newEmail.trim()
    if (next.length === 0 || next === email) {
      return
    }
    setSavingEmail(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: `${window.location.origin}/auth/callback` },
      )
      if (error !== null) {
        notify.error(t('changeEmailError'))
        return
      }
      notify.success(t('changeEmailSent'))
      setNewEmail('')
    } catch {
      notify.error(t('changeEmailError'))
    } finally {
      setSavingEmail(false)
    }
  }

  async function toggleProvider(provider: TOAuthProvider): Promise<void> {
    const supabase = createBrowserSupabaseClient()
    try {
      if (linked.has(provider)) {
        const { data } = await supabase.auth.getUserIdentities()
        const identity = data?.identities.find((i) => i.provider === provider)
        if (identity === undefined) return
        const { error } = await supabase.auth.unlinkIdentity(identity)
        if (error !== null) {
          notify.error(t('socialError'))
          return
        }
        setLinked((prev) => {
          const next = new Set(prev)
          next.delete(provider)
          return next
        })
      } else {
        const { error } = await supabase.auth.linkIdentity({
          provider,
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error !== null) {
          notify.error(t('socialError'))
        }
      }
    } catch {
      notify.error(t('socialError'))
    }
  }

  function onAlertsChange(next: 'on' | 'off'): void {
    const enabled = next === 'on'
    if (enabled === alerts) return
    const previous = alerts
    setAlerts(enabled)
    startTransition(async () => {
      const result = await setAlertsEnabled(enabled)
      if (!result.ok) {
        setAlerts(previous)
        notify.error(t('alertsError'))
      }
    })
  }

  function confirmDelete(): void {
    setDeleting(true)
    void (async () => {
      const result = await deleteAccount()
      if (!result.ok) {
        setDeleting(false)
        notify.error(t('deleteAccountError'))
        return
      }
      router.replace('/')
    })()
  }

  return (
    <div className="space-y-6">
      <section className="border-site-border bg-site-surface/60 space-y-5 rounded-2xl border p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">{t('securityTitle')}</h2>
            <p className="text-site-muted mt-1 text-xs">{t('securityHint')}</p>
          </div>
          {/* Section-level captcha: GoTrue requires a token to email a sign-in link. */}
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onToken={setCaptchaToken}
            resetSignal={captchaReset}
          />
        </div>

        <Row label={t('accessLinkLabel')} hint={t('accessLinkHint', { email })}>
          <Button
            variant="secondary"
            onPress={() => void sendAccessLink()}
            isDisabled={sending || captchaToken === null}
          >
            {sending ? t('accessLinkSending') : t('accessLinkCta')}
          </Button>
        </Row>

        <Row label={t('changeEmailLabel')} hint={t('changeEmailHint', { email })}>
          <div className="flex items-center gap-2">
            <TextInput
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder={t('changeEmailPlaceholder')}
              aria-label={t('changeEmailLabel')}
              surface="subtle"
            />
            <Button
              variant="secondary"
              onPress={() => void changeEmail()}
              isDisabled={savingEmail || newEmail.trim().length === 0}
              className="shrink-0"
            >
              {savingEmail ? t('accessLinkSending') : t('changeEmailCta')}
            </Button>
          </div>
        </Row>

        <Row label={t('socialLabel')} hint={t('socialHint')}>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              {PROVIDERS.map((provider) => {
                const usable = availableProviders.includes(provider) || linked.has(provider)
                return (
                  <Button
                    key={provider}
                    variant={EButtonVariant.NEUTRAL}
                    isDisabled={!usable}
                    onPress={() => void toggleProvider(provider)}
                  >
                    {linked.has(provider)
                      ? t('socialDisconnect', { provider: PROVIDER_LABEL[provider] })
                      : t('socialConnect', { provider: PROVIDER_LABEL[provider] })}
                  </Button>
                )
              })}
            </div>
            {PROVIDERS.some((p) => !availableProviders.includes(p) && !linked.has(p)) ? (
              <p className="text-site-faint max-w-xs text-right text-xs">
                {t('socialNotConfigured')}
              </p>
            ) : null}
          </div>
        </Row>

        <Row label={t('alertsLabel')} hint={t('alertsHint')}>
          <SegmentedControl
            value={alerts ? 'on' : 'off'}
            options={[
              { value: 'on', label: t('siteSmartAgentOn') },
              { value: 'off', label: t('siteSmartAgentOff') },
            ]}
            onChange={onAlertsChange}
            ariaLabel={t('alertsLabel')}
          />
        </Row>
      </section>

      <section className="border-danger/40 bg-site-surface/60 space-y-4 rounded-2xl border p-6">
        <div>
          <h2 className="text-danger text-sm font-semibold">{t('dangerTitle')}</h2>
          <p className="text-site-muted mt-1 text-xs">{t('deleteAccountHint')}</p>
        </div>
        <div className="flex justify-end">
          <Button variant={EButtonVariant.DANGER} onPress={deleteConfirm.show}>
            {t('deleteAccount')}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={deleteConfirm.setOpen}
        title={t('deleteAccountConfirmTitle')}
        description={t('deleteAccountConfirmBody')}
        confirmLabel={t('deleteAccount')}
        cancelLabel={t('deleteCancel')}
        destructive
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/** Label + hint + control row in a settings section. */
function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="border-site-border/60 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-site-muted mt-0.5 text-xs">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
