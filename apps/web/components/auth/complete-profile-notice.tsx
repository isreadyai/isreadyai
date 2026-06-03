'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { notify } from '@/components/ui/toast'
import { useAccount } from '@/lib/use-account'

// MARK: - Complete-profile prompt (fires once when a new account has no name)

const DISMISSED_KEY = 'isready:complete-profile-dismissed'

/** Triggers a notification once for new accounts without a name. */
export function CompleteProfileNotice() {
  const { identity, loading } = useAccount()
  const t = useTranslations('dashboard')
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (loading || identity === null || fired.current || identity.name !== null) {
      return
    }
    if (sessionStorage.getItem(DISMISSED_KEY) === '1') {
      return
    }
    fired.current = true
    sessionStorage.setItem(DISMISSED_KEY, '1')
    notify.action({
      title: t('completeProfilePrompt'),
      actionLabel: t('completeProfileAction'),
      onAction: () => router.push('/dashboard/settings'),
    })
  }, [identity, loading, t, router])

  return null
}
