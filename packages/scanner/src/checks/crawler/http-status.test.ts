import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { httpStatusCheck } from './http-status.ts'

describe('crawler.http-status', () => {
  it('PASS on 200 with real content', async () => {
    const ctx = makeContext({
      status: 200,
      body: '<html><head><title>Pricing</title></head><body>Our plans</body></html>',
    })
    const res = await httpStatusCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('PASS with note on a non-200 2xx', async () => {
    const ctx = makeContext({ status: 204, body: '' })
    const res = await httpStatusCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.detail).toContain('204')
  })

  it('FAIL on 4xx', async () => {
    const ctx = makeContext({ status: 404, body: 'Not found' })
    const res = await httpStatusCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })

  it('FAIL on network error', async () => {
    const ctx = makeContext({ status: 0, error: 'ECONNREFUSED' })
    const res = await httpStatusCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })

  it('WARN on a soft 404 (200 but "not found" content)', async () => {
    const ctx = makeContext({
      status: 200,
      body: '<html><head><title>Page Not Found</title></head><body>404</body></html>',
    })
    const res = await httpStatusCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
  })
})
