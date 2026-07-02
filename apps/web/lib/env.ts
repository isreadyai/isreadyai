// MARK: - Environment variable helpers

// Server-only: reads runtime tuning knobs from process.env with safe fallbacks,
// so operational limits/TTLs stay configurable per deployment without a code change.

/**
 * Reads a non-negative-integer env var (a duration in ms or a count), falling
 * back to `fallback` when unset, empty, or not a finite non-negative number.
 */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.length === 0) {
    return fallback
  }
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/** Reads a non-empty string env var, falling back to `fallback` when unset or empty. */
export function envString(name: string, fallback: string): string {
  const raw = process.env[name]
  return raw !== undefined && raw.length > 0 ? raw : fallback
}
