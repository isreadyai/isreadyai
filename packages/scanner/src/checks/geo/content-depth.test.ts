import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { contentDepthCheck } from './content-depth.ts'
import { RICH_HTML, THIN_HTML } from './fixtures.ts'

// MARK: - geo.content-depth

describe('geo.content-depth', () => {
  test('PASS on a content-rich page', async () => {
    const ctx = makeContext({ body: RICH_HTML })
    const res = await contentDepthCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.wordCount as number).toBeGreaterThanOrEqual(800)
  })

  test('WARN on a thin-but-not-empty page', async () => {
    const body = `<body><p>${'word '.repeat(400)}</p></body>`
    const ctx = makeContext({ body })
    const res = await contentDepthCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBe(0.6)
  })

  test('FAIL on a very thin page', async () => {
    const ctx = makeContext({ body: THIN_HTML })
    const res = await contentDepthCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })
})
