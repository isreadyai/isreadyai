import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { mainContent } from './main-content.ts'

describe('rendering.main-content', () => {
  test('PASS: all four semantic signals present', async () => {
    const body =
      '<html><body><nav>menu</nav>' +
      '<main><h1>Title</h1><h2>Section</h2><p>body</p></main>' +
      '<footer>foot</footer></body></html>'
    const ctx = makeContext({ body })
    const r = await mainContent.run(ctx)
    expect(r.status).toBe('pass')
    expect((r.evidence as { signals: number }).signals).toBe(4)
  })

  test('WARN: three signals present (missing chrome)', async () => {
    const body = '<html><body><main><h1>Title</h1><h2>Section</h2></main></body></html>'
    const ctx = makeContext({ body })
    const r = await mainContent.run(ctx)
    expect(r.status).toBe('warn')
    expect(r.detail).toContain('missing semantic signals')
    expect((r.evidence as { signals: number }).signals).toBe(3)
    expect(r.score).toBe(0.75)
  })

  test('WARN: two signals present', async () => {
    const body = '<html><body><main><h1>Title</h1></main></body></html>'
    const ctx = makeContext({ body })
    const r = await mainContent.run(ctx)
    expect(r.status).toBe('warn')
    expect((r.evidence as { signals: number }).signals).toBe(2)
    expect(r.score).toBe(0.5)
  })

  test('FAIL: zero or one signal', async () => {
    const body = '<html><body><div><h1>A</h1><h1>B</h1></div></body></html>'
    const ctx = makeContext({ body })
    const r = await mainContent.run(ctx)
    expect(r.status).toBe('fail')
    expect((r.evidence as { signals: number }).signals).toBeLessThanOrEqual(1)
  })
})
