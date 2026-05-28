import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { noindexCheck } from './noindex.ts'

describe('crawler.noindex', () => {
  it('PASS with no robots directives', async () => {
    const ctx = makeContext({ body: '<html><head></head><body>Hi</body></html>' })
    const res = await noindexCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('FAIL on a noindex meta tag', async () => {
    const ctx = makeContext({
      body: '<html><head><meta name="robots" content="noindex, follow"></head><body>Hi</body></html>',
    })
    const res = await noindexCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.impact).toBe('high')
  })

  it('FAIL on an X-Robots-Tag noindex header', async () => {
    const ctx = makeContext({ headers: { 'x-robots-tag': 'noindex' }, body: '<html></html>' })
    const res = await noindexCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })

  it('WARN on nofollow only', async () => {
    const ctx = makeContext({
      body: '<html><head><meta name="robots" content="nofollow"></head><body>Hi</body></html>',
    })
    const res = await noindexCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
  })
})
