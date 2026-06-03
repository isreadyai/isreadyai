import { describe, expect, test } from 'bun:test'
import { EPlan } from './plans'
import { ESubscriptionUiState, getSubscriptionSummary, recommendedCta } from './subscription'

const PERIOD_END = '2026-07-15T00:00:00.000Z'

function summary(overrides: Partial<Parameters<typeof getSubscriptionSummary>[0]> = {}) {
  return getSubscriptionSummary({
    plan: EPlan.PRO,
    subscription_status: 'active',
    subscription_current_period_end: PERIOD_END,
    stripe_customer_id: 'cus_123',
    stripe_subscription_id: 'sub_123',
    ...overrides,
  })
}

describe('getSubscriptionSummary status mapping', () => {
  test('active -> ACTIVE / none / renews', () => {
    const s = summary({ subscription_status: 'active' })
    expect(s.uiState).toBe(ESubscriptionUiState.ACTIVE)
    expect(s.severity).toBe('none')
    expect(s.renewsOrEndsLabel).toBe('renews')
    expect(s.currentPeriodEnd).toBeInstanceOf(Date)
  })

  test('trialing -> TRIALING / info / renews', () => {
    const s = summary({ subscription_status: 'trialing' })
    expect(s.uiState).toBe(ESubscriptionUiState.TRIALING)
    expect(s.severity).toBe('info')
    expect(s.renewsOrEndsLabel).toBe('renews')
  })

  test('past_due -> PAST_DUE / critical / ends', () => {
    const s = summary({ subscription_status: 'past_due' })
    expect(s.uiState).toBe(ESubscriptionUiState.PAST_DUE)
    expect(s.severity).toBe('critical')
    expect(s.renewsOrEndsLabel).toBe('ends')
  })

  test('unpaid -> PAST_DUE / critical', () => {
    const s = summary({ subscription_status: 'unpaid' })
    expect(s.uiState).toBe(ESubscriptionUiState.PAST_DUE)
    expect(s.severity).toBe('critical')
  })

  test('canceled with prior subscription -> CANCELED / critical', () => {
    const s = summary({ subscription_status: 'canceled' })
    expect(s.uiState).toBe(ESubscriptionUiState.CANCELED)
    expect(s.severity).toBe('critical')
    expect(s.renewsOrEndsLabel).toBeNull()
  })

  test('incomplete_expired with prior subscription -> CANCELED / critical', () => {
    const s = summary({ subscription_status: 'incomplete_expired' })
    expect(s.uiState).toBe(ESubscriptionUiState.CANCELED)
    expect(s.severity).toBe('critical')
  })

  test('canceled with no prior subscription on free -> CANCELED / none', () => {
    const s = summary({
      subscription_status: 'canceled',
      plan: EPlan.FREE,
      stripe_subscription_id: null,
    })
    expect(s.uiState).toBe(ESubscriptionUiState.CANCELED)
    expect(s.severity).toBe('none')
  })

  test('incomplete -> INCOMPLETE / warning', () => {
    const s = summary({ subscription_status: 'incomplete' })
    expect(s.uiState).toBe(ESubscriptionUiState.INCOMPLETE)
    expect(s.severity).toBe('warning')
  })

  test('paused -> PAUSED / warning', () => {
    const s = summary({ subscription_status: 'paused' })
    expect(s.uiState).toBe(ESubscriptionUiState.PAUSED)
    expect(s.severity).toBe('warning')
  })

  test('free with no customer -> NONE / none', () => {
    const s = getSubscriptionSummary({
      plan: EPlan.FREE,
      subscription_status: null,
      subscription_current_period_end: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    })
    expect(s.uiState).toBe(ESubscriptionUiState.NONE)
    expect(s.severity).toBe('none')
    expect(s.hasStripeCustomer).toBe(false)
    expect(s.currentPeriodEnd).toBeNull()
    expect(s.renewsOrEndsLabel).toBeNull()
  })

  test('unknown status -> NONE', () => {
    const s = summary({ subscription_status: 'something_new' })
    expect(s.uiState).toBe(ESubscriptionUiState.NONE)
    expect(s.severity).toBe('none')
  })
})

describe('cancel_at_period_end branch', () => {
  test('active + cancel_at_period_end -> CANCEL_AT_PERIOD_END / warning / ends', () => {
    const s = summary({ subscription_status: 'active', cancel_at_period_end: true })
    expect(s.uiState).toBe(ESubscriptionUiState.CANCEL_AT_PERIOD_END)
    expect(s.severity).toBe('warning')
    expect(s.cancelAtPeriodEnd).toBe(true)
    expect(s.renewsOrEndsLabel).toBe('ends')
  })

  test('cancel_at_period_end only applies to active status', () => {
    const s = summary({ subscription_status: 'past_due', cancel_at_period_end: true })
    expect(s.uiState).toBe(ESubscriptionUiState.PAST_DUE)
    expect(s.cancelAtPeriodEnd).toBe(true)
  })

  test('cancel_at_period_end defaults to false when omitted', () => {
    const s = summary({ subscription_status: 'active' })
    expect(s.cancelAtPeriodEnd).toBe(false)
    expect(s.uiState).toBe(ESubscriptionUiState.ACTIVE)
  })
})

describe('input coercion', () => {
  test('accepts a Date for the period end', () => {
    const date = new Date(PERIOD_END)
    const s = summary({ subscription_current_period_end: date })
    expect(s.currentPeriodEnd?.getTime()).toBe(date.getTime())
  })

  test('ignores an unparseable period end', () => {
    const s = summary({ subscription_current_period_end: 'not-a-date' })
    expect(s.currentPeriodEnd).toBeNull()
  })

  test('normalizes an unknown plan value to free', () => {
    const s = summary({ plan: 'enterprise', stripe_subscription_id: null })
    expect(s.plan).toBe(EPlan.FREE)
  })
})

describe('recommendedCta', () => {
  test('past_due -> update_payment with portal link', () => {
    const cta = recommendedCta(summary({ subscription_status: 'past_due' }))
    expect(cta.kind).toBe('update_payment')
    expect(cta.portalDeepLink).toBe('/api/stripe/portal')
  })

  test('incomplete -> add_payment', () => {
    const cta = recommendedCta(summary({ subscription_status: 'incomplete' }))
    expect(cta.kind).toBe('add_payment')
    expect(cta.portalDeepLink).toBe('/api/stripe/portal')
  })

  test('cancel_at_period_end -> reactivate', () => {
    const cta = recommendedCta(
      summary({ subscription_status: 'active', cancel_at_period_end: true }),
    )
    expect(cta.kind).toBe('reactivate')
  })

  test('paused -> reactivate', () => {
    const cta = recommendedCta(summary({ subscription_status: 'paused' }))
    expect(cta.kind).toBe('reactivate')
  })

  test('canceled -> choose_plan with no portal link', () => {
    const cta = recommendedCta(summary({ subscription_status: 'canceled' }))
    expect(cta.kind).toBe('choose_plan')
    expect(cta.portalDeepLink).toBeUndefined()
  })

  test('active -> manage', () => {
    const cta = recommendedCta(summary({ subscription_status: 'active' }))
    expect(cta.kind).toBe('manage')
  })

  test('none with no customer -> choose_plan', () => {
    const cta = recommendedCta(
      getSubscriptionSummary({
        plan: EPlan.FREE,
        subscription_status: null,
        subscription_current_period_end: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
      }),
    )
    expect(cta.kind).toBe('choose_plan')
  })

  test('none with existing customer -> manage', () => {
    const cta = recommendedCta(
      getSubscriptionSummary({
        plan: EPlan.FREE,
        subscription_status: null,
        subscription_current_period_end: null,
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: null,
      }),
    )
    expect(cta.kind).toBe('manage')
  })
})
