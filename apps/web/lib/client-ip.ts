// MARK: - Client IP extraction

/**
 * The client IP used for rate-limit keys, from the platform's forwarding headers.
 * Uses the FIRST x-forwarded-for hop: on Vercel the platform sets/normalizes
 * x-forwarded-for so the leftmost entry is the real client. Falls back to
 * x-real-ip, then 'local' so a missing header buckets callers together rather
 * than bypassing the limit.
 *
 * @remarks Trusts the deployment proxy (Vercel) to populate x-forwarded-for.
 * Behind a different reverse proxy, revisit which hop is the real client.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded !== undefined && forwarded.length > 0) {
    return forwarded
  }
  return request.headers.get('x-real-ip') ?? 'local'
}
