'use client'

export const ANALYTICS_CONSENT_STORAGE_KEY = 'isready-cookie-consent'
export const ANALYTICS_CONSENT_EVENT = 'isready-analytics-consent-change'

export type TAnalyticsConsent = 'granted' | 'denied'

export function readAnalyticsConsent(): TAnalyticsConsent | null {
  try {
    const stored = localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)
    return stored === 'granted' || stored === 'denied' ? stored : null
  } catch {
    return null
  }
}

export function writeAnalyticsConsent(choice: TAnalyticsConsent): void {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice)
  } catch {}
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: { choice } }))
}
