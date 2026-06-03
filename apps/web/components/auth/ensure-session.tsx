'use client'

import { useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

// MARK: - Anonymous session bootstrap

/**
 * Guarantees every visitor has a session: if none exists, signs in anonymously
 * (one anon user per browser, persisted via cookie — not per page view). The
 * checkout flow later upgrades that anon user to a real account, preserving its
 * scans. Requires enable_anonymous_sign_ins in the Supabase config.
 */
export function EnsureSession() {
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user === null) {
        await supabase.auth.signInAnonymously().catch(() => undefined)
      }
    })()
  }, [])
  return null
}
