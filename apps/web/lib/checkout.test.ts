import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type Stripe from 'stripe'
import { EPlan } from '@/lib/plans'

// MARK: - startCheckout test setup
//
// Only `getStripe` (and `createServiceClient`) are mocked at the factory
// boundary, both restored in afterAll. `isStripeConfigured`/`getPriceId` stay
// real and are driven through env vars instead: `mock.module` mutates the
// shared module in place across test files, so overriding them here would
// leak into stripe-plan.test.ts's plan-argument-sensitive assertions.

interface ISessionCreateCall {
  params: Record<string, unknown>
  argCount: number
}

interface ISubscriptionUpdateCall {
  id: string
  params: Record<string, unknown>
}

let sessionCreateCalls: ISessionCreateCall[]
let subscriptionUpdateCalls: ISubscriptionUpdateCall[]
let subscriptionListResult: Stripe.Subscription[]

const fakeStripe = {
  subscriptions: {
    list: (_params: Record<string, unknown>) => Promise.resolve({ data: subscriptionListResult }),
    update: (id: string, params: Record<string, unknown>) => {
      subscriptionUpdateCalls.push({ id, params })
      return Promise.resolve({})
    },
    cancel: (_id: string) => Promise.resolve({}),
  },
  checkout: {
    sessions: {
      create: (params: Record<string, unknown>, ...rest: unknown[]) => {
        sessionCreateCalls.push({ params, argCount: 1 + rest.length })
        return Promise.resolve({ url: 'https://checkout.stripe.test/s' })
      },
    },
  },
  customers: {
    create: (_params: Record<string, unknown>, ..._rest: unknown[]) =>
      Promise.resolve({ id: 'cus_new' }),
  },
}

function fakeProfilesTable() {
  return {
    select: (_columns: string) => ({
      eq: (_column: string, _value: string) => ({
        maybeSingle: () => Promise.resolve({ data: { stripe_customer_id: 'cus_1' }, error: null }),
      }),
    }),
    update: (_values: Record<string, unknown>) => ({
      eq: (_column: string, _value: string) => Promise.resolve({ error: null }),
    }),
  }
}

const fakeServiceClient = { from: (_table: string) => fakeProfilesTable() }

const savedStripeSecretKey = process.env.STRIPE_SECRET_KEY
const savedProPrice = process.env.STRIPE_PRO_PRICE_ID
const savedTeamPrice = process.env.STRIPE_TEAM_PRICE_ID

const realStripeLib = await import('@/lib/stripe')
const realSupabase = await import('@isreadyai/supabase')

mock.module('@/lib/stripe', () => ({
  ...realStripeLib,
  getStripe: () => fakeStripe,
}))

mock.module('@isreadyai/supabase', () => ({
  ...realSupabase,
  createServiceClient: () => Promise.resolve(fakeServiceClient),
}))

const { startCheckout } = await import('@/lib/checkout')

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_checkout'
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro'
  process.env.STRIPE_TEAM_PRICE_ID = 'price_team'
})

afterAll(() => {
  process.env.STRIPE_SECRET_KEY = savedStripeSecretKey
  process.env.STRIPE_PRO_PRICE_ID = savedProPrice
  process.env.STRIPE_TEAM_PRICE_ID = savedTeamPrice
  mock.module('@/lib/stripe', () => realStripeLib)
  mock.module('@isreadyai/supabase', () => realSupabase)
})

beforeEach(() => {
  sessionCreateCalls = []
  subscriptionUpdateCalls = []
  subscriptionListResult = []
})

describe('startCheckout', () => {
  test('opens a Checkout session that accepts promotion codes', async () => {
    const result = await startCheckout('user-1', 'a@b.test', EPlan.PRO, 'https://isready.test')

    expect(result).toEqual({ url: 'https://checkout.stripe.test/s' })
    expect(sessionCreateCalls).toHaveLength(1)
    expect(sessionCreateCalls[0]?.argCount).toBe(1)
    expect(sessionCreateCalls[0]?.params).toMatchObject({
      mode: 'subscription',
      customer: 'cus_1',
      allow_promotion_codes: true,
    })
  })

  test('reprices an existing usable subscription instead of opening a session', async () => {
    subscriptionListResult = [
      {
        id: 'sub_1',
        status: 'active',
        created: 1,
        items: { data: [{ id: 'si_1' }] },
      } as unknown as Stripe.Subscription,
    ]

    const result = await startCheckout('user-1', 'a@b.test', EPlan.PRO, 'https://isready.test')

    expect(result).toEqual({ updated: true })
    expect(subscriptionUpdateCalls).toHaveLength(1)
    expect(subscriptionUpdateCalls[0]?.id).toBe('sub_1')
    expect(subscriptionUpdateCalls[0]?.params).toMatchObject({
      items: [{ id: 'si_1', price: 'price_pro' }],
    })
    expect(sessionCreateCalls).toHaveLength(0)
  })
})
