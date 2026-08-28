// MARK: - Banner / section-message severity

/**
 * Severity keys shared by PageBanner and SectionMessage. Kept in a directive-free
 * module on purpose: a Server Component that reads a property of a `'use client'`
 * export receives a client reference instead of the string, which crashes the
 * severity lookup at render time.
 */
export const EPageBannerSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  SUCCESS: 'success',
} as const
export type TPageBannerSeverity = (typeof EPageBannerSeverity)[keyof typeof EPageBannerSeverity]

export const ESectionMessageSeverity = EPageBannerSeverity
export type TSectionMessageSeverity = TPageBannerSeverity
