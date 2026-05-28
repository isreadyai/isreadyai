import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { noscriptFallback } from './noscript-fallback.ts'

// MARK: - fixtures

const words = (n: number): string => Array.from({ length: n }, () => 'word').join(' ')

describe('rendering.noscript', () => {
  test('PASS: raw HTML already carries content', async () => {
    const ctx = makeContext({ body: `<html><body><main><p>${words(80)}</p></main></body></html>` })
    const r = await noscriptFallback.run(ctx)
    expect(r.status).toBe('pass')
  })

  test('PASS: thin but script-free static page is not JS-dependent', async () => {
    const body = `<html><body><h1>Example</h1><p>${words(20)}</p></body></html>`
    const ctx = makeContext({ body })
    const r = await noscriptFallback.run(ctx)
    expect(r.status).toBe('pass')
    expect(r.detail).toContain('no JavaScript')
  })

  test('WARN: thin body but a substantial noscript fallback', async () => {
    const body =
      '<html><body><div id="root"></div><script src="/bundle.js"></script>' +
      `<noscript><p>${words(40)}</p></noscript></body></html>`
    const ctx = makeContext({ body })
    const r = await noscriptFallback.run(ctx)
    expect(r.status).toBe('warn')
    expect(r.detail).toContain('index it poorly')
    expect(r.score).toBe(0.5)
  })

  test('FAIL: thin body and no fallback at all', async () => {
    const body = '<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>'
    const ctx = makeContext({ body })
    const r = await noscriptFallback.run(ctx)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('no fallback at all')
    expect(r.score).toBe(0)
  })
})
