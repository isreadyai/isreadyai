import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { mixedContentCheck } from './mixed-content.ts'

// MARK: - trust.mixed-content

describe('trust.mixed-content', () => {
  test('WARN with examples when insecure sub-resources exist', async () => {
    const body = `
      <html><body>
        <script src="http://cdn.example.com/a.js"></script>
        <img src="http://img.example.com/b.png">
        <link rel="stylesheet" href="http://example.com/c.css">
        <a href="http://safe-anchor.example.com/page">nav link is fine</a>
      </body></html>`
    const ctx = makeContext({ url: 'https://example.com/', body })
    const res = await mixedContentCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.evidence?.count).toBe(3)
    const examples = res.evidence?.examples as string[] | undefined
    expect(examples?.length).toBe(3)
  })

  test('PASS when all resources are https', async () => {
    const body = '<html><body><img src="https://example.com/ok.png"></body></html>'
    const ctx = makeContext({ url: 'https://example.com/', body })
    const res = await mixedContentCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })

  test('INFO when page is http', async () => {
    const body = '<html><body><img src="http://example.com/x.png"></body></html>'
    const ctx = makeContext({ url: 'http://example.com/', body })
    const res = await mixedContentCheck.run(ctx)
    expect(res.status).toBe(EStatus.INFO)
  })

  test('ignores plain anchor links', async () => {
    const body = '<html><body><a href="http://example.com/page">link</a></body></html>'
    const ctx = makeContext({ url: 'https://example.com/', body })
    const res = await mixedContentCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
  })
})
