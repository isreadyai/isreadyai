// MARK: - Same-site redirect guard

const PROBE_ORIGIN = 'https://safe-next.invalid'

/**
 * Returns `raw` only when it is a same-site absolute path, else `/dashboard`.
 * Rejects external and protocol-relative (`//x`) destinations, plus control
 * characters and backslashes: the URL parser strips or reinterprets them, so
 * `/\t/evil.tld` would otherwise resolve off-site.
 */
export function safeNext(raw: string | null | undefined): string {
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    hasUnsafeChar(raw)
  ) {
    return '/dashboard'
  }
  try {
    return new URL(raw, PROBE_ORIGIN).origin === PROBE_ORIGIN ? raw : '/dashboard'
  } catch {
    return '/dashboard'
  }
}

function hasUnsafeChar(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f || code === 0x5c) {
      return true
    }
  }
  return false
}
