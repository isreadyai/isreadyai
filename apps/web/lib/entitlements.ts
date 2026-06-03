import type { TPlan } from '@/lib/plans'
import { EPlan, PLAN_FIX_QUOTA } from '@/lib/plans'

// MARK: - Entitlement shape

export type TMonitoringFrequency = 'none' | 'weekly' | 'daily' | 'hourly'

export interface IEntitlements {
  maxMembers: number
  maxDomains: number
  maxApiKeys: number
  fixRunsPerPeriod: number
  /** AI chat messages allowed per UTC calendar month (metered via the ai_usage ledger). */
  chatMessagesPerMonth: number
  monitoringFrequency: TMonitoringFrequency
  scoreHistoryDays: number
  smartAgent: boolean
  askYourSite: boolean
  aiFixPlans: boolean
  auditLog: boolean
  webhooks: boolean
  monitoringEnabled: boolean
  /** Live README badge — Pro/Team only (a verified Free domain does NOT get a public badge). */
  badge: boolean
  canCreateWorkspaces: boolean
}

// MARK: - Named limits

const FREE_DOMAINS = 1
const FREE_API_KEYS = 1
const PRO_DOMAINS = 5
const PRO_API_KEYS = 5
const TEAM_SEATS = 5
const TEAM_DOMAINS = 25
const TEAM_API_KEYS = 25

const FREE_HISTORY_DAYS = 7
const PRO_HISTORY_DAYS = 90
const TEAM_HISTORY_DAYS = 365

const FREE_CHAT_MESSAGES = 0
const PRO_CHAT_MESSAGES = 300
const TEAM_CHAT_MESSAGES = 1500

// MARK: - Plan → entitlements table

export const PLAN_ENTITLEMENTS: Record<TPlan, IEntitlements> = {
  [EPlan.FREE]: {
    maxMembers: 1,
    maxDomains: FREE_DOMAINS,
    maxApiKeys: FREE_API_KEYS,
    fixRunsPerPeriod: PLAN_FIX_QUOTA[EPlan.FREE],
    chatMessagesPerMonth: FREE_CHAT_MESSAGES,
    monitoringFrequency: 'none',
    scoreHistoryDays: FREE_HISTORY_DAYS,
    smartAgent: false,
    askYourSite: false,
    aiFixPlans: false,
    auditLog: false,
    webhooks: false,
    monitoringEnabled: false,
    badge: false,
    canCreateWorkspaces: false,
  },
  [EPlan.PRO]: {
    maxMembers: 1,
    maxDomains: PRO_DOMAINS,
    maxApiKeys: PRO_API_KEYS,
    fixRunsPerPeriod: PLAN_FIX_QUOTA[EPlan.PRO],
    chatMessagesPerMonth: PRO_CHAT_MESSAGES,
    monitoringFrequency: 'daily',
    scoreHistoryDays: PRO_HISTORY_DAYS,
    smartAgent: true,
    askYourSite: true,
    aiFixPlans: true,
    auditLog: false,
    webhooks: false,
    monitoringEnabled: true,
    badge: true,
    canCreateWorkspaces: false,
  },
  [EPlan.TEAM]: {
    maxMembers: TEAM_SEATS,
    maxDomains: TEAM_DOMAINS,
    maxApiKeys: TEAM_API_KEYS,
    fixRunsPerPeriod: PLAN_FIX_QUOTA[EPlan.TEAM],
    chatMessagesPerMonth: TEAM_CHAT_MESSAGES,
    monitoringFrequency: 'hourly',
    scoreHistoryDays: TEAM_HISTORY_DAYS,
    smartAgent: true,
    askYourSite: true,
    aiFixPlans: true,
    auditLog: true,
    webhooks: true,
    monitoringEnabled: true,
    badge: true,
    canCreateWorkspaces: true,
  },
}

// MARK: - Gate results

export const EEntitlementReason = {
  PLAN_REQUIRED: 'plan_required',
  QUOTA_EXCEEDED: 'quota_exceeded',
  ROLE_REQUIRED: 'role_required',
  BILLING_ISSUE: 'billing_issue',
  FEATURE_UNAVAILABLE: 'feature_unavailable',
} as const

export type TEntitlementReason = (typeof EEntitlementReason)[keyof typeof EEntitlementReason]

export type TGateResult =
  | { allowed: true }
  | { allowed: false; reason: TEntitlementReason; requiredPlan?: TPlan }

// MARK: - Resolution

export function resolveEntitlements(plan: TPlan): IEntitlements {
  return PLAN_ENTITLEMENTS[plan]
}

// MARK: - Feature gating

type TBooleanFeatureKey = {
  [K in keyof IEntitlements]: IEntitlements[K] extends boolean ? K : never
}[keyof IEntitlements]

export type TQuotaKey = 'maxDomains' | 'maxApiKeys' | 'maxMembers'

// Cheapest-first so the suggested upgrade is the lowest plan that grants the feature.
const PLAN_PRICE_ORDER: readonly TPlan[] = [EPlan.FREE, EPlan.PRO, EPlan.TEAM]

function cheapestPlanWith(feature: TBooleanFeatureKey): TPlan | undefined {
  return PLAN_PRICE_ORDER.find((plan) => PLAN_ENTITLEMENTS[plan][feature])
}

export function checkFeature(plan: TPlan, feature: TBooleanFeatureKey): TGateResult {
  if (resolveEntitlements(plan)[feature]) {
    return { allowed: true }
  }

  const requiredPlan = cheapestPlanWith(feature)
  if (requiredPlan === undefined) {
    return { allowed: false, reason: EEntitlementReason.FEATURE_UNAVAILABLE }
  }

  return { allowed: false, reason: EEntitlementReason.PLAN_REQUIRED, requiredPlan }
}

export function checkQuota(plan: TPlan, key: TQuotaKey, current: number): TGateResult {
  const limit = resolveEntitlements(plan)[key]
  if (current < limit) {
    return { allowed: true }
  }

  // A higher plan with a larger limit is the path forward; otherwise it's a hard cap.
  const requiredPlan = PLAN_PRICE_ORDER.find(
    (candidate) => PLAN_ENTITLEMENTS[candidate][key] > limit,
  )
  if (requiredPlan === undefined) {
    return { allowed: false, reason: EEntitlementReason.QUOTA_EXCEEDED }
  }

  return { allowed: false, reason: EEntitlementReason.QUOTA_EXCEEDED, requiredPlan }
}
