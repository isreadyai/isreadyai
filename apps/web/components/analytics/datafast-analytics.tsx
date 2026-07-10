'use client'

import { useEffect } from 'react'
import {
  ANALYTICS_CONSENT_EVENT,
  readAnalyticsConsent,
  type TAnalyticsConsent,
} from '@/lib/analytics-consent'
import { isDataFastEnabledForCurrentHost, startDataFast, stopDataFast } from '@/lib/datafast'

type TIdleWindow = typeof window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function scheduleIdleTask(task: () => void): () => void {
  const idleWindow = window as TIdleWindow
  let done = false
  const run = () => {
    if (done) {
      return
    }
    done = true
    task()
  }

  const timeout = window.setTimeout(run, 2000)
  const idle = idleWindow.requestIdleCallback?.(run, { timeout: 2000 }) ?? null

  return () => {
    done = true
    window.clearTimeout(timeout)
    if (idle !== null) {
      idleWindow.cancelIdleCallback?.(idle)
    }
  }
}

function shouldStartDataFast(): boolean {
  return isDataFastEnabledForCurrentHost() && readAnalyticsConsent() === 'granted'
}

export function DataFastAnalytics() {
  useEffect(() => {
    let cancelScheduledStart: (() => void) | null = null

    const scheduleStart = () => {
      cancelScheduledStart?.()
      if (!shouldStartDataFast()) {
        return
      }
      cancelScheduledStart = scheduleIdleTask(() => {
        cancelScheduledStart = null
        void startDataFast()
      })
    }

    const stop = () => {
      cancelScheduledStart?.()
      cancelScheduledStart = null
      void stopDataFast()
    }

    scheduleStart()

    const onConsentChange = (event: Event) => {
      const choice = (event as CustomEvent<{ choice?: TAnalyticsConsent }>).detail?.choice
      if (choice === 'granted') {
        scheduleStart()
      } else if (choice === 'denied') {
        stop()
      }
    }

    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsentChange)
    return () => {
      cancelScheduledStart?.()
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsentChange)
    }
  }, [])

  return null
}
