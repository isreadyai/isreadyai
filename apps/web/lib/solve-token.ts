// MARK: - Ephemeral solve token (HMAC-signed, short-lived, inference-scoped)

/**
 * The premium fix action runs the LLM agent INSIDE the runner; isready.ai's
 * real AI Gateway key never leaves the server. /api/solve-token mints this
 * short-lived HMAC token, the runner sends it to /api/solve-inference, and that
 * proxy validates it and forwards inference to the gateway with the real key.
 *
 * The token is deliberately NOT a gateway credential: it is opaque to the
 * gateway and only meaningful to isready.ai's proxy, so a leaked token expires
 * fast, is scoped to inference, is pinned to one model, and is call-budgeted.
 */

export interface ISolveClaims {
  /** api_keys.id of the premium key that minted it. */
  sub: string
  scope: 'inference'
  /** Pinned model — the proxy overrides any model in the request body. */
  model: string
  /** Unique run id (also the fix_runs id) and the call-budget bucket key. */
  jti: string
  /** Max inference calls this token may make. */
  calls: number
  iat: number
  exp: number
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlJson(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)))
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** The signing secret; the caller must treat absence as "feature disabled". */
export function solveSecret(): string | null {
  const secret = process.env.SOLVE_TOKEN_SECRET
  return secret !== undefined && secret.length >= 32 ? secret : null
}

export async function signSolveToken(claims: ISolveClaims, secret: string): Promise<string> {
  const head = base64urlJson({ alg: 'HS256', typ: 'JWT' })
  const body = base64urlJson(claims)
  const data = `${head}.${body}`
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(data),
  )
  return `${data}.${base64url(new Uint8Array(signature))}`
}

/** Constant-time verify + expiry/scope check. Returns null on any failure. */
export async function verifySolveToken(
  token: string,
  secret: string,
): Promise<ISolveClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  const [head, body, signature] = parts as [string, string, string]
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    fromBase64url(signature),
    new TextEncoder().encode(`${head}.${body}`),
  )
  if (!valid) {
    return null
  }
  let claims: ISolveClaims
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as ISolveClaims
  } catch {
    return null
  }
  if (claims.scope !== 'inference' || typeof claims.exp !== 'number') {
    return null
  }
  if (Date.now() >= claims.exp * 1000) {
    return null
  }
  return claims
}
