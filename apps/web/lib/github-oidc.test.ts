import { describe, expect, mock, test } from 'bun:test'

// MARK: - GitHub OIDC repository proof
//
// jose is mocked so jwtVerify's payload / rejection can be driven without a real
// signed token or a network JWKS fetch.

let verifyImpl: () => Promise<{ payload: Record<string, unknown> }>
mock.module('jose', () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: () => verifyImpl(),
}))

const { verifyGithubRepoOidc } = await import('@/lib/github-oidc')

describe('verifyGithubRepoOidc', () => {
  test('returns the identity when the immutable numeric id matches', async () => {
    verifyImpl = async () => ({ payload: { repository_id: '123', repository: 'octo/repo' } })
    expect(await verifyGithubRepoOidc('tok', '123')).toEqual({
      repositoryId: '123',
      ownerRepo: 'octo/repo',
    })
  })

  test('rejects a repository_id mismatch (squatting attempt)', async () => {
    verifyImpl = async () => ({ payload: { repository_id: '999', repository: 'evil/repo' } })
    expect(await verifyGithubRepoOidc('tok', '123')).toBeNull()
  })

  test('coerces a numeric repository_id claim to string', async () => {
    verifyImpl = async () => ({ payload: { repository_id: 123, repository: 'octo/repo' } })
    expect(await verifyGithubRepoOidc('tok', '123')).toEqual({
      repositoryId: '123',
      ownerRepo: 'octo/repo',
    })
  })

  test('rejects an empty token without verifying', async () => {
    verifyImpl = async () => {
      throw new Error('jwtVerify must not be called for an empty token')
    }
    expect(await verifyGithubRepoOidc('', '123')).toBeNull()
  })

  test('rejects an invalid token (bad signature / aud / exp throws)', async () => {
    verifyImpl = async () => {
      throw new Error('signature verification failed')
    }
    expect(await verifyGithubRepoOidc('tok', '123')).toBeNull()
  })
})
