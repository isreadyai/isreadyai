import type { Tables } from '@isreadyai/supabase'

type TStoredPlan = Tables<'profiles'>['plan'] | Tables<'api_keys'>['plan']

export const EPlan = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
} as const satisfies Record<string, TStoredPlan>

type TDeclaredPlan = (typeof EPlan)[keyof typeof EPlan]

export type TPlan = Extract<TDeclaredPlan, TStoredPlan>
export type TPaidPlan = Exclude<TPlan, typeof EPlan.FREE>

const PLANS = new Set<TStoredPlan>(Object.values(EPlan))

/** Fix-PR runs allowed per rolling 30 days. Fix-PR is premium. */
export const PLAN_FIX_QUOTA: Record<TPlan, number> = {
  [EPlan.FREE]: 0,
  [EPlan.PRO]: 200,
  [EPlan.TEAM]: 1000,
}

export function isPlan(value: TStoredPlan): value is TPlan {
  return PLANS.has(value)
}

export function planOrFree(value: TStoredPlan | null | undefined): TPlan {
  return value !== null && value !== undefined && isPlan(value) ? value : EPlan.FREE
}

export function isPaidPlan(value: TStoredPlan): value is TPaidPlan {
  return value === EPlan.PRO || value === EPlan.TEAM
}
