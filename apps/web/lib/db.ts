// MARK: - Checked Supabase writes
//
// Supabase query builders resolve to { data, error } instead of throwing, so an
// awaited write whose error is ignored looks like success. These adapters make a
// provider error explicit at the call site — required for writes whose silent
// failure corrupts product state (entitlements, billing, ownership, quota).

interface IPostgrestResult<T> {
  data: T | null
  error: { message: string } | null
}

/** Throws when a Supabase result carries a provider error; use on writes whose silent failure is a correctness bug. */
export function requireSuccess(
  result: { error: { message: string } | null },
  context: string,
): void {
  if (result.error !== null) {
    throw new Error(`${context}: ${result.error.message}`)
  }
}

/** Like {@link requireSuccess} but also asserts a row was returned (throws on null data). */
export function requireData<T>(result: IPostgrestResult<T>, context: string): T {
  if (result.error !== null) {
    throw new Error(`${context}: ${result.error.message}`)
  }
  if (result.data === null) {
    throw new Error(`${context}: no row returned`)
  }
  return result.data
}
