import { prefersReducedMotion } from '@/lib/motion'

// MARK: - Email capture (the one live signup surface until auth lands)

export const EMAIL_REPORT_INPUT_ID = 'email-report-input'

/** Premium/signup CTAs scroll to and focus the email field. */
export function goToEmailCapture(): void {
  const input = document.getElementById(EMAIL_REPORT_INPUT_ID)
  input?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    block: 'center',
  })
  window.setTimeout(() => input?.focus({ preventScroll: true }), 350)
}
