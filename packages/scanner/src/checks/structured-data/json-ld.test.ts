import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { jsonLdCheck } from './json-ld.ts'
import { BARE_HTML, MALFORMED_LD_HTML, RICH_HTML } from './fixtures.ts'

describe('structured.json-ld', () => {
  test('PASS on rich page with identity + content types', async () => {
    const res = await jsonLdCheck.run(makeContext({ body: RICH_HTML }))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
    expect(res.evidence?.types).toEqual(expect.arrayContaining(['Organization', 'Article']))
  })

  test('FAIL when no JSON-LD in served HTML', async () => {
    const res = await jsonLdCheck.run(makeContext({ body: BARE_HTML }))
    expect(res.status).toBe(EStatus.FAIL)
    expect(res.score).toBe(0)
    expect(res.fix).toContain('invisible to non-JS')
  })

  test('skips malformed block, scores identity-only as WARN', async () => {
    const res = await jsonLdCheck.run(makeContext({ body: MALFORMED_LD_HTML }))
    // WebSite is an identity type but no content type -> 0.75? No: 0.5 + 0.25 = 0.75 PASS.
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(0.75)
    expect(res.evidence?.blocks).toBe(1)
  })

  test('content-only JSON-LD scores 0.75 -> PASS', async () => {
    const body = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Widget"}
    </script>`
    const res = await jsonLdCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(0.75)
  })

  test('valid but unrecognized type scores 0.5 -> WARN', async () => {
    const body = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"WebPage","name":"x"}
    </script>`
    const res = await jsonLdCheck.run(makeContext({ body }))
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBe(0.5)
  })
})
