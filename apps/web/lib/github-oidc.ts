import { createRemoteJWKSet, jwtVerify } from 'jose'
import { SITE_URL } from '@/lib/site'

// MARK: - GitHub Actions OIDC repository proof

const ISSUER = 'https://token.actions.githubusercontent.com'
// Verified against the token `aud` so a token minted for another service can't be replayed here.
const AUDIENCE = (process.env.CI_OIDC_AUDIENCE ?? SITE_URL).replace(/\/+$/, '')
// Created once: the resolver caches keys and follows GitHub's key rotation.
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`))

/** A verified GitHub Actions run identity, restricted to repository-proving claims. */
export interface IGithubRepoIdentity {
  /** GitHub's immutable numeric repository id (stable across rename/transfer). */
  repositoryId: string
  /** Human-readable `owner/repo`, for display only. */
  ownerRepo: string
}

function claimString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return ''
}

/**
 * Verifies a GitHub Actions OIDC token and confirms it attests `expectedRepositoryId`,
 * returning the proven identity or `null`. Defeats repository-id squatting by matching
 * the immutable numeric id, which (unlike owner/repo) cannot be re-registered.
 */
export async function verifyGithubRepoOidc(
  token: string,
  expectedRepositoryId: string,
): Promise<IGithubRepoIdentity | null> {
  if (token === '') {
    return null
  }
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
    })
    const repositoryId = claimString(payload.repository_id)
    if (repositoryId === '' || repositoryId !== expectedRepositoryId) {
      return null
    }
    return { repositoryId, ownerRepo: claimString(payload.repository) }
  } catch {
    return null
  }
}
