import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { httpsCheck } from './https.ts'

// MARK: - trust.https

describe('trust.https', () => {
  test('PASS on valid https', async () => {
    const ctx = makeContext({ url: 'https://example.com/', tls: { valid: true } })
    const res = await httpsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  test('FAIL on http final url', async () => {
    const ctx = makeContext({ url: 'http://example.com/' })
    const res = await httpsCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.fix).toBeDefined()
  })

  test('FAIL on invalid tls with error in evidence', async () => {
    const ctx = makeContext({
      url: 'https://example.com/',
      tls: { valid: false, error: 'CERT_HAS_EXPIRED' },
    })
    const res = await httpsCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.evidence?.tlsError).toBe('CERT_HAS_EXPIRED')
  })
})
