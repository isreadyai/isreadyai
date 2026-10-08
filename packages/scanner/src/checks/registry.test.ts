import { describe, expect, it } from 'bun:test'
import { allChecks } from './index.ts'

// Anti-drift guard: the public copy binds to allChecks.length, but CONTRIBUTING.md
// references PUBLISHED_CHECK_COUNT in its "Add a check" step, so update both together.
const PUBLISHED_CHECK_COUNT = 35

describe('checks.registry', () => {
  it('matches the published check count', () => {
    expect(allChecks).toHaveLength(PUBLISHED_CHECK_COUNT)
  })

  it('has unique check ids', () => {
    const ids = allChecks.map((check) => check.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('registers the contact, link text and feed checks', () => {
    const ids = allChecks.map((check) => check.id)
    expect(ids).toEqual(
      expect.arrayContaining(['structured.contact-details', 'geo.link-text', 'crawler.feed']),
    )
  })
})
