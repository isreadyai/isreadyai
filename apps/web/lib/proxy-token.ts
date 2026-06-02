import { createHmac, timingSafeEqual } from 'node:crypto'

// MARK: - Proxy token

/**
 * Short-lived HMAC-SHA256 tokens that bind a deep-scan crawl to a specific
 * target host. Prevents /api/proxy from acting as an open relay even though
 * Origin/Referer are already checked: a stolen Origin header cannot mint a
 * token for a host the server never issued.
 *
 * Token format: `${exp}.${normalizedHost}.${base64urlSig}`
 *   exp            — Unix ms timestamp (expiry)
 *   normalizedHost — lowercase, www-stripped hostname[:port]
 *   base64urlSig   — HMAC-SHA256 over `${normalizedHost}:${exp}`
 *
 * Parsing is unambiguous: exp has no dots; the sig is base64url (no dots);
 * everything between the first and last dot is the host (may contain dots).
 */

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

export function signProxyToken(host: string): string {
  const secret = process.env.PROXY_TOKEN_SECRET
  if (!secret) {
    throw new Error('PROXY_TOKEN_SECRET is not configured')
  }
  const normalized = normalizeHost(host)
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = `${normalized}:${exp}`
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${exp}.${normalized}.${sig}`
}

export function verifyProxyToken(token: string, host: string): boolean {
  const secret = process.env.PROXY_TOKEN_SECRET
  if (!secret) {
    return false
  }
  try {
    const firstDot = token.indexOf('.')
    if (firstDot === -1) {
      return false
    }
    const expStr = token.slice(0, firstDot)
    const rest = token.slice(firstDot + 1)
    const lastDot = rest.lastIndexOf('.')
    if (lastDot === -1) {
      return false
    }
    const tokenHost = rest.slice(0, lastDot)
    const sig = rest.slice(lastDot + 1)
    const exp = Number(expStr)
    if (!Number.isFinite(exp) || Date.now() > exp) {
      return false
    }
    const normalized = normalizeHost(host)
    if (tokenHost !== normalized) {
      return false
    }
    const payload = `${normalized}:${expStr}`
    const expected = createHmac('sha256', secret).update(payload).digest('base64url')
    const sigBuf = Buffer.from(sig, 'base64url')
    const expectedBuf = Buffer.from(expected, 'base64url')
    if (sigBuf.length !== expectedBuf.length) {
      return false
    }
    return timingSafeEqual(sigBuf, expectedBuf)
  } catch {
    return false
  }
}
