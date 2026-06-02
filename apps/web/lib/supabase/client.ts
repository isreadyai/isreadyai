import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@isreadyai/supabase'

// MARK: - Browser Supabase client (publishable key, session via cookies)

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  )
}
