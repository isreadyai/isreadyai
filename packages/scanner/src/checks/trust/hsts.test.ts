import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { hstsCheck } from './hsts.ts'

// MARK: - trust.hsts

describe('trust.hsts', () => {
  test('PASS when header present', async () => {
    const ctx = makeContext({
      headers: { 'strict-transport-security': 'max-age=31536000; includeSubDomains' },
    })
    const res = await hstsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.value).toContain('max-age')
  })

  test('PASS but notes weak max-age in detail', async () => {
    const ctx = makeContext({ headers: { 'strict-transport-security': 'max-age=600' } })
    const res = await hstsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.detail).toContain('below the recommended')
    expect(res.evidence?.maxAge).toBe(600)
  })

  test('WARN when missing', async () => {
    const ctx = makeContext({ headers: { 'content-type': 'text/html' } })
    const res = await hstsCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.fix).toBeDefined()
  })
})
