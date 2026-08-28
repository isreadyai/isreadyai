import { describe, expect, test } from 'bun:test'
import type Stripe from 'stripe'
import { invoiceSubscriptionId, subscriptionPeriodEnd } from './stripe-objects'

function invoiceWithParent(parent: unknown): Stripe.Invoice {
  return { parent } as unknown as Stripe.Invoice
}

function subscriptionWithItems(items: Array<{ current_period_end: number }>): Stripe.Subscription {
  return { items: { data: items } } as unknown as Stripe.Subscription
}

describe('invoiceSubscriptionId', () => {
  test('returns null when the invoice has no parent', () => {
    expect(invoiceSubscriptionId(invoiceWithParent(null))).toBeNull()
  })

  test('returns the subscription id from a string reference', () => {
    const parent = {
      type: 'subscription_details',
      subscription_details: { subscription: 'sub_1', metadata: null },
    }
    expect(invoiceSubscriptionId(invoiceWithParent(parent))).toBe('sub_1')
  })

  test('returns the subscription id from an expanded object', () => {
    const parent = {
      type: 'subscription_details',
      subscription_details: { subscription: { id: 'sub_2' }, metadata: null },
    }
    expect(invoiceSubscriptionId(invoiceWithParent(parent))).toBe('sub_2')
  })

  test('returns null when subscription_details is null', () => {
    const parent = { type: 'quote_details', subscription_details: null }
    expect(invoiceSubscriptionId(invoiceWithParent(parent))).toBeNull()
  })
})

describe('subscriptionPeriodEnd', () => {
  test('returns null when the subscription has no items', () => {
    expect(subscriptionPeriodEnd(subscriptionWithItems([]))).toBeNull()
  })

  test('returns the single item period end', () => {
    expect(subscriptionPeriodEnd(subscriptionWithItems([{ current_period_end: 100 }]))).toBe(100)
  })

  test('returns the latest period end across multiple items', () => {
    const subscription = subscriptionWithItems([
      { current_period_end: 100 },
      { current_period_end: 250 },
    ])
    expect(subscriptionPeriodEnd(subscription)).toBe(250)
  })
})
