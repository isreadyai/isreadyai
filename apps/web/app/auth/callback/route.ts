import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - GET /auth/callback — exchange the OAuth/magic-link code for a session

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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
