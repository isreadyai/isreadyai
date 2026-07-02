import { timingSafeEqual } from 'node:crypto'

// MARK: - Cron auth

/**
 * Constant-time check that a request carries the Vercel Cron Bearer token.
 * Returns false when CRON_SECRET is unset/empty so an unconfigured deploy can
 * never be triggered by a bare `Bearer ` header.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret === undefined || secret.length === 0) {
    return false
  }
  const provided = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  // Length must match before timingSafeEqual — it throws on differing lengths.
  if (provided.length !== expected.length) {
    return false
  }
  return timingSafeEqual(provided, expected)
}
