import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { EPlan } from './plans'
import { higherPlan, planFromPrice, planFromStatus } from './stripe-plan'

const PRO_PRICE = 'price_pro_123'
const TEAM_PRICE = 'price_team_456'

const savedPro = process.env.STRIPE_PRO_PRICE_ID
const savedTeam = process.env.STRIPE_TEAM_PRICE_ID

beforeAll(() => {
  process.env.STRIPE_PRO_PRICE_ID = PRO_PRICE
  process.env.STRIPE_TEAM_PRICE_ID = TEAM_PRICE
})

afterAll(() => {
  process.env.STRIPE_PRO_PRICE_ID = savedPro
  process.env.STRIPE_TEAM_PRICE_ID = savedTeam
})

describe('planFromPrice', () => {
  test('maps configured price ids to their plan', () => {
    expect(planFromPrice(PRO_PRICE)).toBe(EPlan.PRO)
    expect(planFromPrice(TEAM_PRICE)).toBe(EPlan.TEAM)
  })

  test('returns null for an unknown or missing price', () => {
    expect(planFromPrice('price_unknown')).toBeNull()
    expect(planFromPrice(null)).toBeNull()
  })
})

describe('planFromStatus', () => {
  test('active and trialing grant the subscribed price plan', () => {
    expect(planFromStatus('active', EPlan.PRO, EPlan.FREE)).toBe(EPlan.PRO)
    expect(planFromStatus('trialing', EPlan.TEAM, EPlan.FREE)).toBe(EPlan.TEAM)
  })

  test('active with an unknown price keeps the current plan', () => {
    expect(planFromStatus('active', null, EPlan.TEAM)).toBe(EPlan.TEAM)
  })

  test('canceled and incomplete_expired drop to free', () => {
    expect(planFromStatus('canceled', EPlan.PRO, EPlan.PRO)).toBe(EPlan.FREE)
    expect(planFromStatus('incomplete_expired', EPlan.TEAM, EPlan.TEAM)).toBe(EPlan.FREE)
  })

  test('past_due keeps the current plan as a bounded retry grace', () => {
    expect(planFromStatus('past_due', EPlan.PRO, EPlan.PRO)).toBe(EPlan.PRO)
    expect(planFromStatus('past_due', EPlan.TEAM, EPlan.TEAM)).toBe(EPlan.TEAM)
  })

  test('unpaid, paused and incomplete revoke entitlements to free', () => {
    expect(planFromStatus('unpaid', EPlan.TEAM, EPlan.TEAM)).toBe(EPlan.FREE)
    expect(planFromStatus('paused', EPlan.PRO, EPlan.PRO)).toBe(EPlan.FREE)
    expect(planFromStatus('incomplete', EPlan.PRO, EPlan.PRO)).toBe(EPlan.FREE)
  })
})

describe('higherPlan', () => {
  test('Team outranks Pro outranks Free, order-independent', () => {
    expect(higherPlan(EPlan.PRO, EPlan.TEAM)).toBe(EPlan.TEAM)
    expect(higherPlan(EPlan.TEAM, EPlan.PRO)).toBe(EPlan.TEAM)
    expect(higherPlan(EPlan.FREE, EPlan.PRO)).toBe(EPlan.PRO)
    expect(higherPlan(EPlan.PRO, EPlan.FREE)).toBe(EPlan.PRO)
  })

  test('returns the same plan when both match', () => {
    expect(higherPlan(EPlan.TEAM, EPlan.TEAM)).toBe(EPlan.TEAM)
    expect(higherPlan(EPlan.FREE, EPlan.FREE)).toBe(EPlan.FREE)
  })
})
