// MARK: - Client IP extraction

/**
 * Whether forwarding headers are trustworthy. Defaults to true (Vercel sets
 * `x-real-ip`/`x-forwarded-for` itself); self-hosted deploys with no trusted proxy
 * set `TRUST_PROXY_HEADERS=false` so a caller can't spoof those headers to dodge
 * per-IP rate limits.
 */
function trustsProxyHeaders(): boolean {
  const flag = process.env.TRUST_PROXY_HEADERS
  return flag !== 'false' && flag !== '0'
}

/**
 * The client IP for rate-limit keys, from a trusted source. Prefers Vercel's
 * unspoofable `x-real-ip`; falls back to the RIGHTMOST `x-forwarded-for` hop (the
 * one our proxy appends — leftmost entries are attacker-spoofable), else 'local'.
 */
export function clientIp(request: Request): string {
  // Untrusted proxy chain: collapse everyone to the shared bucket, since the only
  // headers that would distinguish callers are themselves spoofable here.
  if (!trustsProxyHeaders()) {
    return 'local'
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp !== undefined && realIp !== '') {
    return realIp
  }
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded !== null) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter((hop) => hop !== '')
    const trusted = hops[hops.length - 1]
    if (trusted !== undefined) {
      return trusted
    }
  }
  return 'local'
}
