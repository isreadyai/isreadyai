import { createHmac, timingSafeEqual } from 'node:crypto'
import { envInt } from '@/lib/env'
import { tokenSecret } from '@/lib/proxy-token'

// MARK: - Scan write token

// A capability the creator's browser holds: anonymous scans have no owner, so the
// server can't tell the creator from a shared-link visitor — only the holder of
// this scan-bound HMAC may write the deep-scan result back onto the row.

const TOKEN_TTL_MS = envInt('SCAN_WRITE_TOKEN_TTL_MS', 2 * 60 * 60 * 1000)
const PREFIX = 'scan-write'

function sign(scanId: string, exp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${PREFIX}:${scanId}:${exp}`).digest('base64url')
}

/** Signs a token authorizing a deep-scan write onto `scanId`. Throws if no secret. */
export function signScanWriteToken(scanId: string): string {
  const secret = tokenSecret()
  if (secret === null) {
    throw new Error('PROXY_TOKEN_SECRET is not configured')
  }
  const exp = String(Date.now() + TOKEN_TTL_MS)
  return `${exp}.${sign(scanId, exp, secret)}`
}

/** True when `token` is a live, untampered write capability for `scanId`. */
export function verifyScanWriteToken(token: string, scanId: string): boolean {
  const secret = tokenSecret()
  if (secret === null) {
    return false
  }
  const dot = token.indexOf('.')
  if (dot === -1) {
    return false
  }
  const expStr = token.slice(0, dot)
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return false
  }
  const provided = Buffer.from(token.slice(dot + 1), 'base64url')
  const expected = Buffer.from(sign(scanId, expStr, secret), 'base64url')
  if (provided.length !== expected.length) {
    return false
  }
  return timingSafeEqual(provided, expected)
}
