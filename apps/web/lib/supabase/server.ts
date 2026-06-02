import type { Database } from '@isreadyai/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// MARK: - Server Supabase client (session-aware, RLS-scoped to the user)

/**
 * For Server Components, Route Handlers and Server Actions. Uses the
 * publishable key + cookies, so RLS applies (this is NOT the service client).
 * The setAll try/catch absorbs the Server Component case where cookies are
 * read-only — middleware already refreshes the session there.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component — middleware owns the refresh.
          }
        },
      },
    },
  )
}
