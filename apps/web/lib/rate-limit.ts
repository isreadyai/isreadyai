import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'

// MARK: - Shared, cross-instance rate limiting

// Per-instance fallback: used in dev (no Supabase) and as a degraded guard when
// the shared store errors, so abuse is never completely unbounded.
const memory = new Map<string, number[]>()

function memoryAllow(key: string, windowMs: number, limit: number): boolean {
  const now = Date.now()
  const hits = (memory.get(key) ?? []).filter((t) => t > now - windowMs)
  if (hits.length >= limit) {
    memory.set(key, hits)
    return false
  }
  hits.push(now)
  memory.set(key, hits)
  return true
}

/**
 * Consumes one unit against a SHARED, cross-instance rate limit (the
 * consume_rate_limit Postgres function), returning true when the caller is within
 * `limit` for the current `windowMs` window. Replaces module-level Map counters,
 * which reset per serverless cold start and aren't shared between instances.
 *
 * Without Supabase (dev) it uses a per-instance in-memory window; on a metering
 * error it FAILS OPEN to that same in-memory guard — availability over
 * enforcement for a transient blip, with per-instance protection still applied.
 */
export async function consumeRateLimit(
  key: string,
  windowMs: number,
  limit: number,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return memoryAllow(key, windowMs, limit)
  }
  try {
    const client = await createServiceClient()
    const { data, error } = await client.rpc('consume_rate_limit', {
      p_key: key,
      p_window_ms: windowMs,
      p_limit: limit,
    })
    if (error !== null || typeof data !== 'boolean') {
      return memoryAllow(key, windowMs, limit)
    }
    return data
  } catch {
    return memoryAllow(key, windowMs, limit)
  }
}
