import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { contactDetailsCheck } from './contact-details.ts'

const run = (body: string) => contactDetailsCheck.run(makeContext({ body }))

describe('structured.contact-details', () => {
  test('PASS via JSON-LD contactPoint nested in @graph', async () => {
    const body = `<script type="application/ld+json">{"@graph":[{"@type":"Organization","contactPoint":{"@type":"ContactPoint","telephone":"+1 555 0100"}}]}</script>`
    const res = await run(body)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
    expect(res.evidence?.jsonLdKeys).toEqual(['contactPoint', 'telephone'])
  })

  test('PASS via mailto link', async () => {
    const res = await run('<a href="mailto:hi@example.com">Email us</a>')
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.mailto).toBe(true)
    expect(res.detail).toContain('mailto link')
  })

  test('PASS via tel link', async () => {
    const res = await run('<a href="tel:+15550100">Call</a>')
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.tel).toBe(true)
  })

  test('PASS via <address> element', async () => {
    const res = await run('<address>1 Main St, Springfield</address>')
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.addressElement).toBe(true)
  })

  test('WARN with score 0.5 when only a /contact link exists', async () => {
    const res = await run('<a href="/contact">Get in touch</a>')
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBe(0.5)
    expect(res.impact).toBe('low')
    expect(res.fix).toBeDefined()
    expect(res.evidence?.contactLink).toBe(true)
  })

  test('WARN with score 0.5 for a "Contact us" text link', async () => {
    const res = await run('<a href="https://example.com/reach">Contact us</a>')
    expect(res.score).toBe(0.5)
  })

  test('WARN with score 0 when nothing exists', async () => {
    const res = await run('<a href="/about">About</a><a href="/contactless-payments">Pay</a>')
    expect(res.status).toBe(EStatus.WARN)
    expect(res.score).toBe(0)
    expect(res.impact).toBe('medium')
    expect(res.detail).toBe('no contact details or contact page link found')
  })

  test('malformed JSON-LD is ignored', async () => {
    const res = await run('<script type="application/ld+json">{oops</script>')
    expect(res.score).toBe(0)
  })
})
