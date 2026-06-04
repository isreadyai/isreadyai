'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { notify } from '@/components/ui/toast'

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 5

/** Surfaces Stripe checkout completion state as a toast; polls for webhook activation. */
export function CheckoutFeedback({
  status,
  activated,
}: {
  status: 'success' | 'cancelled'
  activated: boolean
}) {
  const t = useTranslations('billing')
  const router = useRouter()
  const announced = useRef(false)

  // Cancelled, or success whose plan is already active: announce once, clean URL.
  useEffect(() => {
    if (announced.current) {
      return
    }
    if (status === 'cancelled') {
      announced.current = true
      notify.info(`${t('checkout.cancelledTitle')} — ${t('checkout.cancelledDescription')}`)
      router.replace('/dashboard/billing')
      return
    }
    if (status === 'success' && activated) {
      announced.current = true
      notify.success(t('checkout.successTitle'))
      router.replace('/dashboard/billing')
    }
    // router/t are stable; re-run only when the settle state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activated])

  // Success but the webhook hasn't flipped the plan yet: tell the user we're
  // activating and poll a few refreshes; the effect above fires success once
  // `activated` turns true.
  useEffect(() => {
    if (status !== 'success' || activated) {
      return
    }
    notify.info(t('checkout.activatingTitle'))
    let polls = 0
    const id = setInterval(() => {
      polls += 1
      router.refresh()
      if (polls >= MAX_POLLS) {
        clearInterval(id)
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activated])

  return null
}
