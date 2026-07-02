// MARK: - Same-site redirect guard

/**
 * Returns `raw` only when it is a same-site absolute path, else `/dashboard`.
 * Rejects external, protocol-relative (`//x`) and backslash (`/\x`) destinations,
 * which the URL parser would otherwise resolve to an off-site host.
 */
export function safeNext(raw: string | null | undefined): string {
  if (
    typeof raw === 'string' &&
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    !raw.startsWith('/\\')
  ) {
    return raw
  }
  return '/dashboard'
}
