// MARK: - URL display helpers

/** Host of a URL, falling back to the raw string for malformed input. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Canonical host for storage and comparison: lowercased with a single leading
 * `www.` stripped. Other subdomains and any port are preserved, so
 * `massimo.deluisa.bio`, `arianna.deluisa.bio` and `deluisa.bio` stay distinct.
 * Accepts a full URL or a bare host. Mirrors the `scans.host` generated column.
 */
export function normalizeHost(input: string): string {
  return hostOf(input.trim())
    .toLowerCase()
    .replace(/^www\./, '')
}
