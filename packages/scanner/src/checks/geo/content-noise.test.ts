import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { contentNoiseCheck } from './content-noise.ts'
import { RICH_HTML } from './fixtures.ts'

// MARK: - geo.content-noise

describe('geo.content-noise', () => {
  test('PASS when main content dominates', async () => {
    const ctx = makeContext({ body: RICH_HTML })
    const res = await contentNoiseCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.ratio as number).toBeGreaterThanOrEqual(0.5)
  })

  test('WARN when content is roughly half chrome', async () => {
    const main = `<main><p>${'word '.repeat(100)}</p></main>`
    const chrome = `<nav>${'nav '.repeat(200)}</nav>`
    const ctx = makeContext({ body: `<body>${chrome}${main}</body>` })
    const res = await contentNoiseCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
  })

  test('FAIL when content drowned in chrome', async () => {
    const main = `<main><p>${'word '.repeat(20)}</p></main>`
    const chrome = `<nav>${'nav '.repeat(500)}</nav>`
    const ctx = makeContext({ body: `<body>${chrome}${main}</body>` })
    const res = await contentNoiseCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })

  test('INFO when no semantic main/article', async () => {
    const ctx = makeContext({ body: `<body><div>${'word '.repeat(50)}</div></body>` })
    const res = await contentNoiseCheck.run(ctx)
    expect(res.status).toBe(EStatus.INFO)
    expect(res.score).toBe(0.5)
  })
})
