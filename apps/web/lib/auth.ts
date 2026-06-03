import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - Authenticated user resolution

/**
 * Returns the verified user from the SSR session, or null. Uses getUser (not
 * getSession) so the JWT is validated against Supabase Auth, never trusted from
 * the cookie alone.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
