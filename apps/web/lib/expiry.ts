// MARK: - Expiry helpers (shared by the invite-expiry displays)

/**
 * Whole days remaining until an ISO timestamp, rounded up and floored at 1, so a
 * still-valid expiry never reads as "0 days". Callers only render future
 * timestamps (the invite lists filter out expired rows server-side), so the
 * result is always >= 1. Used to show a relative "expires in N days" instead of
 * an absolute date, which kept the static "7 days" copy from matching the real
 * remaining time on older invites.
 */
export function daysUntil(iso: string): number {
  const ms = Date.parse(iso) - Date.now()
  return Math.max(1, Math.ceil(ms / 86_400_000))
}
