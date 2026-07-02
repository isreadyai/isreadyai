import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { gaSessionFromCookies, sendGaEvent } from '@/lib/analytics-server'
import { safeNext } from '@/lib/safe-next'

// MARK: - GET /auth/callback — exchange the OAuth/magic-link code for a session

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code !== null) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error === null) {
      // Consent gate: social sign-ins never accept Terms/Privacy at signup, so
      // route them to /welcome first and carry `next` through to land them where
      // they were headed. Email signups seed terms_accepted_at and skip this.
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user !== null) {
        // GA4 sign_up for brand-new accounts only (created within 10 min — the
        // callback is their first authenticated request). No-ops without consent.
        if (Date.now() - Date.parse(user.created_at) < 600_000) {
          const cookieStore = await cookies()
          const ga = gaSessionFromCookies((name) => cookieStore.get(name)?.value)
          await sendGaEvent(ga, 'sign_up', { method: user.app_metadata?.provider ?? 'email' })
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('terms_accepted_at')
          .eq('id', user.id)
          .maybeSingle()
        if (profile === null || profile.terms_accepted_at === null) {
          const welcome = new URL('/welcome', origin)
          welcome.searchParams.set('next', next)
          return NextResponse.redirect(welcome)
        }
      }
      return NextResponse.redirect(new URL(next, origin))
    }
  }
  return NextResponse.redirect(new URL('/login?error=auth', origin))
}
