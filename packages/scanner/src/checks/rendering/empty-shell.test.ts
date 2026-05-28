import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { emptyShell } from './empty-shell.ts'

// MARK: - fixtures

const words = (n: number): string => `<p>${Array.from({ length: n }, () => 'word').join(' ')}</p>`

describe('rendering.empty-shell', () => {
  test('PASS: substantive content in raw HTML', async () => {
    const ctx = makeContext({ body: `<html><body><main>${words(150)}</main></body></html>` })
    const r = await emptyShell.run(ctx)
    expect(r.status).toBe('pass')
  })

  test('PASS: SSR Next.js with __NEXT_DATA__ and 150 words is not flagged', async () => {
    const body =
      '<html><body><div id="__next">' +
      `<main>${words(150)}</main></div>` +
      '<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>' +
      '</body></html>'
    const ctx = makeContext({ body })
    const r = await emptyShell.run(ctx)
    expect(r.status).toBe('pass')
    expect((r.evidence as { words: number }).words).toBeGreaterThanOrEqual(100)
  })

  test('FAIL: empty SPA mount node with no content', async () => {
    const body = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>'
    const ctx = makeContext({ body })
    const r = await emptyShell.run(ctx)
    expect(r.status).toBe('fail')
    expect((r.evidence as { hasFingerprint: boolean }).hasFingerprint).toBe(true)
    expect(r.fix).toBeDefined()
  })

  test('FAIL: angular fingerprint with near-empty body', async () => {
    const body = '<html><body><app-root ng-version="17.0.0"></app-root></body></html>'
    const ctx = makeContext({ body })
    const r = await emptyShell.run(ctx)
    expect(r.status).toBe('fail')
  })

  test('WARN: near-empty initial HTML without a known fingerprint', async () => {
    const body = `<html><body><div>${words(10)}</div></body></html>`
    const ctx = makeContext({ body })
    const r = await emptyShell.run(ctx)
    expect(r.status).toBe('warn')
    expect(r.detail).toContain('near-empty')
    expect(r.score).toBe(0.5)
  })

  test('WARN: thin initial HTML (30-99 words)', async () => {
    const ctx = makeContext({ body: `<html><body><main>${words(60)}</main></body></html>` })
    const r = await emptyShell.run(ctx)
    expect(r.status).toBe('warn')
    expect(r.detail).toContain('thin')
  })
})
