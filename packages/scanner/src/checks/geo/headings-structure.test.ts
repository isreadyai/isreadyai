import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { headingsStructureCheck } from './headings-structure.ts'
import { RICH_HTML } from './fixtures.ts'

// MARK: - geo.headings

describe('geo.headings', () => {
  test('PASS on a well-structured page', async () => {
    const ctx = makeContext({ body: RICH_HTML })
    const res = await headingsStructureCheck.run(ctx)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.h1).toBe(1)
  })

  test('WARN with two of three signals', async () => {
    // Single h1 + 2 h2 but sparse (dense check fails on a long body).
    const body = `<body><h1>One</h1><h2>A</h2><h2>B</h2><p>${'word '.repeat(2000)}</p></body>`
    const ctx = makeContext({ body })
    const res = await headingsStructureCheck.run(ctx)
    expect(res.status).toBe(EStatus.WARN)
  })

  test('FAIL with one or zero signals', async () => {
    const body = `<body><h1>One</h1><h1>Two</h1><p>${'word '.repeat(2000)}</p></body>`
    const ctx = makeContext({ body })
    const res = await headingsStructureCheck.run(ctx)
    expect(res.status).toBe(EStatus.FAIL)
  })
})
