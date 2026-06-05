import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Tables } from '@isreadyai/supabase'
import { SITE_URL } from '@/lib/site'

// MARK: - Badge token signing

const TOKEN_VERSION = 'v1'
const MIN_SECRET_LENGTH = 32

export interface IBadgeTokenClaims {
  apiKeyId: Tables<'api_keys'>['id']
}

export function createBadgeToken(
  domain: string,
  apiKeyId: IBadgeTokenClaims['apiKeyId'],
  secret: string,
): string {
  assertValidSecret(secret)
  const encodedKeyId = Buffer.from(apiKeyId).toString('base64url')
  const signature = createHmac('sha256', secret)
    .update(tokenPayload(domain, encodedKeyId))
    .digest('base64url')
  return `${TOKEN_VERSION}.${encodedKeyId}.${signature}`
}

export function verifyBadgeToken(
  domain: string,
  token: string,
  secret: string,
): IBadgeTokenClaims | null {
  if (secret.length < MIN_SECRET_LENGTH) {
    return null
  }

  const [version, encodedKeyId, signature, extra] = token.split('.')
  if (
    version !== TOKEN_VERSION ||
    encodedKeyId === undefined ||
    encodedKeyId.length === 0 ||
    signature === undefined ||
    signature.length === 0 ||
    extra !== undefined
  ) {
    return null
  }

  const expected = Buffer.from(
    createHmac('sha256', secret).update(tokenPayload(domain, encodedKeyId)).digest('base64url'),
  )
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null
  }

  const apiKeyId = Buffer.from(encodedKeyId, 'base64url').toString('utf8')
  return Buffer.from(apiKeyId).toString('base64url') === encodedKeyId ? { apiKeyId } : null
}

/** The shields-style markdown an owner embeds; the token unlocks the real badge. */
export function badgeMarkdown(
  host: string,
  apiKeyId: IBadgeTokenClaims['apiKeyId'],
  secret: string,
): string {
  const token = createBadgeToken(host, apiKeyId, secret)
  const badgeUrl = `${SITE_URL}/badge/${encodeURIComponent(host)}?token=${encodeURIComponent(token)}`
  return `[![AI ready](${badgeUrl})](${SITE_URL})`
}

export function getBadgeSigningSecret(): string | null {
  const secret = process.env.BADGE_SIGNING_SECRET
  return secret !== undefined && secret.length >= MIN_SECRET_LENGTH ? secret : null
}

function tokenPayload(domain: string, encodedKeyId: string): string {
  return `${TOKEN_VERSION}:${domain.trim().toLowerCase().replace(/\.$/, '')}:${encodedKeyId}`
}

function assertValidSecret(secret: string): void {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`BADGE_SIGNING_SECRET must contain at least ${MIN_SECRET_LENGTH} characters`)
  }
}
