import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - POST /auth/sign-out — clear the session and return home

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', new URL(request.url).origin), { status: 303 })
}
