import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AcceptInvite } from '@/components/dashboard/accept-invite'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard')
  return { title: t('teamAcceptTitle'), robots: { index: false, follow: false } }
}

/**
 * Team invite acceptance page — self-gated outside (dashboard) to preserve deep link through auth/consent.
 *
 * A server layout can't read the pathname, so it can't survive the login + /welcome consent gate redirect loop.
 * This leaf page knows its own token and can rebuild the deep link on every gate hop.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const deepLink = `/invite/${token}`
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    redirect(`/login?redirect=${encodeURIComponent(deepLink)}`)
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()
  if (profile === null || profile.terms_accepted_at === null) {
    redirect(`/welcome?next=${encodeURIComponent(deepLink)}`)
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

      <div className="hero-rise w-full max-w-md">
        <AcceptInvite token={token} />
      </div>
    </main>
  )
}
