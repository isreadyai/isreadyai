'use server'

import { createServiceClient } from '@isreadyai/supabase'
import type { TActionResult } from '@/lib/action-result'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - Terms & privacy consent

/**
 * Records that the authenticated user accepted the Terms & Privacy. The user is
 * re-verified server-side (never trust the client), then terms_accepted_at is
 * stamped via the service client — profiles has no authenticated UPDATE policy,
 * since its columns are otherwise service-role-only. Idempotent: re-calling just
 * refreshes the timestamp, and the gate only checks for non-null.
 */
export async function acceptTerms(): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  const service = await createServiceClient()
  const { error } = await service
    .from('profiles')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
