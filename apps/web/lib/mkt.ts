/** Number of campaign hero variants (`heroVariants.1..N` in the messages). */
export const MKT_VARIANT_COUNT = 8

/**
 * Resolves the `?mkt` param to a hero variant index, or 0 — the default copy the
 * canonical URL and bots always get — for anything outside 1..MKT_VARIANT_COUNT.
 */
export function parseMkt(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw // Next yields string[] for a repeated query param
  if (value === undefined || value === '') {
    return 0
  }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > MKT_VARIANT_COUNT) {
    return 0
  }
  return n
}
