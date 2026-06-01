// MARK: - URL display helpers

/** Host of a URL, falling back to the raw string for malformed input. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
