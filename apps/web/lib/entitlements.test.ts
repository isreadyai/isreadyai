import { test, expect } from 'bun:test'

import { EPlan } from '@/lib/plans'
import {
  EEntitlementReason,
  PLAN_ENTITLEMENTS,
  checkFeature,
  checkQuota,
  resolveEntitlements,
} from '@/lib/entitlements'

// MARK: - Resolution

test('resolveEntitlements returns the plan table entry', () => {
  expect(resolveEntitlements(EPlan.FREE)).toBe(PLAN_ENTITLEMENTS[EPlan.FREE])
  expect(resolveEntitlements(EPlan.TEAM)).toBe(PLAN_ENTITLEMENTS[EPlan.TEAM])
})

test('fixRunsPerPeriod is derived from PLAN_FIX_QUOTA values', () => {
  expect(resolveEntitlements(EPlan.FREE).fixRunsPerPeriod).toBe(0)
  expect(resolveEntitlements(EPlan.PRO).fixRunsPerPeriod).toBe(200)
  expect(resolveEntitlements(EPlan.TEAM).fixRunsPerPeriod).toBe(1000)
})

// MARK: - Feature gates

test('smartAgent: free is gated to pro, pro/team allowed', () => {
  expect(checkFeature(EPlan.FREE, 'smartAgent')).toEqual({
    allowed: false,
    reason: EEntitlementReason.PLAN_REQUIRED,
    requiredPlan: EPlan.PRO,
  })
  expect(checkFeature(EPlan.PRO, 'smartAgent')).toEqual({ allowed: true })
  expect(checkFeature(EPlan.TEAM, 'smartAgent')).toEqual({ allowed: true })
})

test('auditLog: free and pro are gated to team', () => {
  for (const plan of [EPlan.FREE, EPlan.PRO] as const) {
    expect(checkFeature(plan, 'auditLog')).toEqual({
      allowed: false,
      reason: EEntitlementReason.PLAN_REQUIRED,
      requiredPlan: EPlan.TEAM,
    })
  }
  expect(checkFeature(EPlan.TEAM, 'auditLog')).toEqual({ allowed: true })
})

test('canCreateWorkspaces is team-only', () => {
  expect(checkFeature(EPlan.PRO, 'canCreateWorkspaces').allowed).toBe(false)
  expect(checkFeature(EPlan.TEAM, 'canCreateWorkspaces')).toEqual({ allowed: true })
})

// MARK: - Quota gates

test('maxDomains: free allows one tracked site (free badge), then gates to pro', () => {
  expect(checkQuota(EPlan.FREE, 'maxDomains', 0)).toEqual({ allowed: true })
  expect(checkQuota(EPlan.FREE, 'maxDomains', 1)).toEqual({
    allowed: false,
    reason: EEntitlementReason.QUOTA_EXCEEDED,
    requiredPlan: EPlan.PRO,
  })
})

test('maxDomains boundary: pro allows up to limit then blocks', () => {
  const limit = PLAN_ENTITLEMENTS[EPlan.PRO].maxDomains
  expect(checkQuota(EPlan.PRO, 'maxDomains', limit - 1)).toEqual({ allowed: true })
  expect(checkQuota(EPlan.PRO, 'maxDomains', limit)).toEqual({
    allowed: false,
    reason: EEntitlementReason.QUOTA_EXCEEDED,
    requiredPlan: EPlan.TEAM,
  })
})

test('maxApiKeys boundary on team is a hard cap with no upgrade plan', () => {
  const limit = PLAN_ENTITLEMENTS[EPlan.TEAM].maxApiKeys
  expect(checkQuota(EPlan.TEAM, 'maxApiKeys', limit - 1)).toEqual({ allowed: true })
  expect(checkQuota(EPlan.TEAM, 'maxApiKeys', limit)).toEqual({
    allowed: false,
    reason: EEntitlementReason.QUOTA_EXCEEDED,
  })
})

test('maxMembers: free single seat blocks a second member', () => {
  expect(checkQuota(EPlan.FREE, 'maxMembers', 1)).toEqual({
    allowed: false,
    reason: EEntitlementReason.QUOTA_EXCEEDED,
    requiredPlan: EPlan.TEAM,
  })
})
