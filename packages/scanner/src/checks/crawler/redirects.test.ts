import { describe, expect, it } from 'bun:test'
import { EStatus } from '../../types.ts'
import { makeContext } from '../../testing.ts'
import { redirectsCheck } from './redirects.ts'

function hop(from: string, to: string, status = 301) {
  return { url: from, status, location: to }
}

describe('crawler.redirects', () => {
  it('PASS with zero redirects', async () => {
    const ctx = makeContext({ redirects: [] })
    const res = await redirectsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('PASS with two redirects', async () => {
    const ctx = makeContext({
      redirects: [hop('http://a/', 'https://a/'), hop('https://a/', 'https://a/home')],
    })
    const res = await redirectsCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  it('WARN with three or more redirects', async () => {
    const ctx = makeContext({
      redirects: [hop('1', '2'), hop('2', '3'), hop('3', '4')],
    })
    const res = await redirectsCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect((res.evidence as { hopCount: number }).hopCount).toBe(3)
  })

  it('FAIL on a redirect loop', async () => {
    const ctx = makeContext({
      redirects: [hop('a', 'b'), hop('b', 'a')],
      error: 'Redirect loop detected',
    })
    const res = await redirectsCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })
})
