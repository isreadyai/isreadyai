import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'
import { WelcomeConsent } from '@/components/welcome/welcome-consent'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('welcome')
  // Authenticated consent gate — never index it, and don't follow into the app.
  return { title: t('title'), robots: { index: false, follow: false } }
}

const BULLETS = [
  { icon: 'scan', titleKey: 'bulletScanTitle', bodyKey: 'bulletScanBody' },
  { icon: 'track', titleKey: 'bulletTrackTitle', bodyKey: 'bulletTrackBody' },
  { icon: 'fix', titleKey: 'bulletFixTitle', bodyKey: 'bulletFixBody' },
] as const

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNext((await searchParams).next)
  const t = await getTranslations('welcome')

  // Re-derive consent server-side so this page is never a dead end: a signed-out
  // visitor goes to login; an already-consented user skips straight to `next`
  // (e.g. a stale link, or a second tab). Only the un-consented see the gate.
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    redirect(`/login?redirect=${encodeURIComponent(next)}`)
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()
  if (profile !== null && profile.terms_accepted_at !== null) {
    redirect(next)
  }

  return (
    <main className="bg-site-background relative isolate flex min-h-dvh flex-col items-center justify-center px-6 py-12 sm:py-16">
      <div className="bg-grid-faint absolute inset-0 -z-10" aria-hidden="true" />

      <Link
        href="/"
        className="hero-rise mb-9 flex items-baseline gap-1 font-semibold tracking-tight"
      >
        <span className="text-site-accent" aria-hidden="true">
          ◆
        </span>
        <span>isready</span>
        <span className="text-site-muted">.ai</span>
      </Link>

      <section
        aria-labelledby="welcome-heading"
        className="hero-rise border-site-border bg-site-surface/60 w-full max-w-xl rounded-3xl border p-8 shadow-2xl sm:p-10"
      >
        <p className="text-site-secondary font-mono text-xs tracking-wide uppercase">
          {t('kicker')}
        </p>
        <h1 id="welcome-heading" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {t('title')}
        </h1>
        <p className="text-site-muted mt-3 text-sm leading-relaxed sm:text-base">{t('subtitle')}</p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {BULLETS.map((bullet) => (
            <li
              key={bullet.icon}
              className="border-site-border/70 bg-site-raised/30 rounded-xl border p-4"
            >
              <span className="bg-site-secondary/12 text-site-secondary inline-flex size-9 items-center justify-center rounded-lg">
                <BulletIcon name={bullet.icon} />
              </span>
              <p className="mt-3 text-sm font-semibold">{t(bullet.titleKey)}</p>
              <p className="text-site-muted mt-1 text-xs leading-relaxed">{t(bullet.bodyKey)}</p>
            </li>
          ))}
        </ul>

        <WelcomeConsent next={next} />
      </section>
    </main>
  )
}

function BulletIcon({ name }: { name: (typeof BULLETS)[number]['icon'] }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'size-5',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'scan':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      )
    case 'track':
      return (
        <svg {...common}>
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
      )
    case 'fix':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z" />
        </svg>
      )
  }
}
