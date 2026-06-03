'use client'

import type { IAccountIdentity } from '@/lib/avatar'
import { useEffect, useState } from 'react'
import { resolveAccountIdentity } from '@/lib/avatar'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

// MARK: - Current account (client session, avatar resolved)

type TSupabaseUser = NonNullable<
  Awaited<
    ReturnType<ReturnType<typeof createBrowserSupabaseClient>['auth']['getUser']>
  >['data']['user']
>

function readMetaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function useAccount(): { identity: IAccountIdentity | null; loading: boolean } {
  const [identity, setIdentity] = useState<IAccountIdentity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let supabase: ReturnType<typeof createBrowserSupabaseClient>
    try {
      supabase = createBrowserSupabaseClient()
    } catch {
      setLoading(false)
      return
    }

    async function apply(user: TSupabaseUser | null): Promise<void> {
      if (user === null) {
        if (active) {
          setIdentity(null)
          setLoading(false)
        }
        return
      }
      const meta = user.user_metadata
      const resolved = await resolveAccountIdentity({
        email: user.email ?? null,
        name:
          readMetaString(meta, 'display_name') ??
          readMetaString(meta, 'full_name') ??
          readMetaString(meta, 'name'),
        uploadedAvatarUrl: readMetaString(meta, 'avatar_url') ?? readMetaString(meta, 'picture'),
      })
      if (active) {
        setIdentity(resolved)
        setLoading(false)
      }
    }

    void supabase.auth.getUser().then(({ data }) => apply(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void apply(session?.user ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { identity, loading }
}
