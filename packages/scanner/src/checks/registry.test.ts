import { describe, expect, it } from 'bun:test'
import { allChecks } from './index.ts'

// Anti-drift guard for the public copy. Several places state a fixed check
// count instead of binding to allChecks.length dynamically, so this test fails
// if the registry size changes, forcing every one of them to be updated in
// lockstep:
// - apps/web/i18n/messages/en.json: onboarding.stepScan.body, pricing.fAudit,
//   how.step3Body, why.p3
// - README.md (Roadmap — "Scanner engine — N checks…")
// - CONTRIBUTING.md (the "Add a check" step referencing PUBLISHED_CHECK_COUNT)
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
