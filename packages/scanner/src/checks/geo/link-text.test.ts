import { describe, expect, test } from 'bun:test'
import { makeContext } from '../../testing.ts'
import { EStatus } from '../../types.ts'
import { linkTextCheck } from './link-text.ts'

const run = (body: string) => linkTextCheck.run(makeContext({ body }))
const links = (count: number, text: string) =>
  Array.from({ length: count }, (_, i) => `<a href="/p${i}">${text}</a>`).join('')

describe('geo.link-text', () => {
  test('PASS for descriptive links', async () => {
    const res = await run(links(8, 'Pricing plans'))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.score).toBe(1)
    expect(res.evidence?.considered).toBe(8)
  })

  test('PASS with fewer than 5 links even when generic', async () => {
    const res = await run(links(4, 'read more'))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.detail).toBe('too few links to judge link text (4)')
  })

  test('WARN for many "read more" links, examples capped at 5', async () => {
    const res = await run(links(8, 'Read more...') + '<a href="/a">About the team</a>')
    expect(res.status).toBe(EStatus.WARN)
    expect(res.detail).toBe('8 of 9 links use generic or empty text (89%)')
    expect(res.score).toBeCloseTo(0.25, 5)
    expect(res.impact).toBe('low')
    expect(res.effort).toBe('low')
    expect(res.fix).toBeDefined()
    expect(res.evidence?.generic).toBe(8)
    expect(res.evidence?.examples).toHaveLength(5)
  })

  test('icon-only link without a label counts as unlabeled', async () => {
    const body = links(3, 'Docs') + '<a href="/x"><svg></svg></a>'.repeat(3)
    const res = await run(body)
    expect(res.status).toBe(EStatus.WARN)
    expect(res.evidence?.unlabeled).toBe(3)
    expect(res.evidence?.generic).toBe(0)
  })

  test('icon link with aria-label is not unlabeled', async () => {
    const body = links(5, 'Docs') + '<a href="/x" aria-label="Home"><svg></svg></a>'.repeat(4)
    const res = await run(body)
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.unlabeled).toBe(0)
  })

  test('#, javascript:, mailto: and tel: links are ignored', async () => {
    const ignored = ['#top', 'javascript:void(0)', 'mailto:a@b.co', 'tel:123']
      .map((href) => `<a href="${href}">click here</a>`)
      .join('')
    const res = await run(ignored + links(5, 'Pricing'))
    expect(res.status).toBe(EStatus.PASS)
    expect(res.evidence?.considered).toBe(5)
    expect(res.evidence?.generic).toBe(0)
  })

  test('PASS when weak links are under 3 or under 10%', async () => {
    const few = await run(links(2, 'here') + links(3, 'Pricing'))
    expect(few.status).toBe(EStatus.PASS)
    const small = await run(links(3, 'here') + links(40, 'Pricing'))
    expect(small.status).toBe(EStatus.PASS)
  })
})
