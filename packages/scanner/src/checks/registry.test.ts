import { describe, expect, it } from 'bun:test'
import { allChecks } from './index.ts'

// Anti-drift guard for the public copy. The homepage and FAQ state a fixed
// "32 evidence-based checks" (en.json how.step3Body / why.p3). The hero/stats
// counters bind to allChecks.length dynamically, but the prose number does not
// — so this test fails if the registry size changes, forcing the copy to be
// updated in lockstep. Keep this number and the marketing copy in sync.
const PUBLISHED_CHECK_COUNT = 32

describe('checks.registry', () => {
  it('matches the "32 checks" claimed in the public copy', () => {
    expect(allChecks).toHaveLength(PUBLISHED_CHECK_COUNT)
  })

  it('has unique check ids', () => {
    const ids = allChecks.map((check) => check.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
