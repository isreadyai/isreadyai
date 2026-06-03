import type { TPlan } from '@/lib/plans'
import { isPaidPlan, planOrFree } from '@/lib/plans'

// MARK: - UI state machine

/**
 * UI-facing billing states. Distinct from raw Stripe statuses: collapses Stripe
 * statuses + the cancel_at_period_end flag into the states the Settings panel
 * actually renders.
 */
export const ESubscriptionUiState = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCEL_AT_PERIOD_END: 'cancel_at_period_end',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  PAUSED: 'paused',
  NONE: 'none',
} as const

export type TSubscriptionUiState = (typeof ESubscriptionUiState)[keyof typeof ESubscriptionUiState]

export type TSubscriptionSeverity = 'none' | 'info' | 'warning' | 'critical'

export interface ISubscriptionSummary {
  plan: TPlan
  uiState: TSubscriptionUiState
  status: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  hasStripeCustomer: boolean
  severity: TSubscriptionSeverity
  renewsOrEndsLabel: 'renews' | 'ends' | null
}

// MARK: - Input

/**
 * Raw billing fields as stored on profiles. period end arrives as a serialized
 * timestamptz (string) from the DB, but a Date is accepted too. cancel_at_period_end
 * is optional on the input only for back-compat with callers that omit it; the
 * Stripe webhook persists it to profiles (column added in migration 20260615120000).
 */
export interface IGetSubscriptionSummaryInput {
  plan: string | null | undefined
  subscription_status: string | null | undefined
  subscription_current_period_end: string | Date | null | undefined
  stripe_customer_id: string | null | undefined
  stripe_subscription_id: string | null | undefined
  cancel_at_period_end?: boolean | null
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// MARK: - Summary derivation

export function getSubscriptionSummary(input: IGetSubscriptionSummaryInput): ISubscriptionSummary {
  const plan = planOrFree(input.plan)
  const status = input.subscription_status ?? null
  const currentPeriodEnd = toDate(input.subscription_current_period_end)
  const hasStripeCustomer =
    typeof input.stripe_customer_id === 'string' && input.stripe_customer_id.length > 0
  const cancelAtPeriodEnd = input.cancel_at_period_end === true
  // A real subscription existed iff Stripe handed us a subscription id. Used to
  // tell a meaningful cancellation (critical) from a stray/never-paid record.
  const hadSubscription =
    typeof input.stripe_subscription_id === 'string' && input.stripe_subscription_id.length > 0

  let uiState: TSubscriptionUiState
  let severity: TSubscriptionSeverity

  switch (status) {
    case 'active':
      if (cancelAtPeriodEnd) {
        uiState = ESubscriptionUiState.CANCEL_AT_PERIOD_END
        severity = 'warning'
      } else {
        uiState = ESubscriptionUiState.ACTIVE
        severity = 'none'
      }
      break
    case 'trialing':
      uiState = ESubscriptionUiState.TRIALING
      severity = 'info'
      break
    case 'past_due':
    case 'unpaid':
      uiState = ESubscriptionUiState.PAST_DUE
      severity = 'critical'
      break
    case 'canceled':
    case 'incomplete_expired':
      uiState = ESubscriptionUiState.CANCELED
      // Only alarming if they were a paying customer who lost access.
      severity = hadSubscription || isPaidPlan(plan) ? 'critical' : 'none'
      break
    case 'incomplete':
      uiState = ESubscriptionUiState.INCOMPLETE
      severity = 'warning'
      break
    case 'paused':
      uiState = ESubscriptionUiState.PAUSED
      severity = 'warning'
      break
    default:
      uiState = ESubscriptionUiState.NONE
      severity = 'none'
      break
  }

  const renewsOrEndsLabel = resolveRenewsOrEnds(uiState, currentPeriodEnd)

  return {
    plan,
    uiState,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    hasStripeCustomer,
    severity,
    renewsOrEndsLabel,
  }
}

/** Whether the period-end date reads as a renewal, a hard end, or nothing. */
function resolveRenewsOrEnds(
  uiState: TSubscriptionUiState,
  currentPeriodEnd: Date | null,
): 'renews' | 'ends' | null {
  if (currentPeriodEnd === null) {
    return null
  }
  switch (uiState) {
    case ESubscriptionUiState.ACTIVE:
    case ESubscriptionUiState.TRIALING:
      return 'renews'
    case ESubscriptionUiState.CANCEL_AT_PERIOD_END:
    case ESubscriptionUiState.PAST_DUE:
      return 'ends'
    default:
      return null
  }
}

// MARK: - Recommended CTA

export type TBillingCtaKind =
  | 'update_payment'
  | 'choose_plan'
  | 'reactivate'
  | 'add_payment'
  | 'manage'
  | 'none'

export interface TBillingCta {
  kind: TBillingCtaKind
  portalDeepLink?: string
  /** Stripe portal deep-link flow to POST to the portal route, when applicable. */
  flow?: 'payment_method_update' | 'subscription_cancel'
}

const PORTAL_DEEP_LINK = '/api/stripe/portal'

/**
 * The single primary action the billing panel should surface for a given
 * summary. portalDeepLink points at the Stripe billing portal route for actions
 * that Stripe owns (payment method, reactivation, plan management).
 */
export function recommendedCta(summary: ISubscriptionSummary): TBillingCta {
  switch (summary.uiState) {
    case ESubscriptionUiState.PAST_DUE:
      return {
        kind: 'update_payment',
        portalDeepLink: PORTAL_DEEP_LINK,
        flow: 'payment_method_update',
      }
    case ESubscriptionUiState.INCOMPLETE:
      return {
        kind: 'add_payment',
        portalDeepLink: PORTAL_DEEP_LINK,
        flow: 'payment_method_update',
      }
    case ESubscriptionUiState.CANCEL_AT_PERIOD_END:
    case ESubscriptionUiState.PAUSED:
      return { kind: 'reactivate', portalDeepLink: PORTAL_DEEP_LINK }
    case ESubscriptionUiState.CANCELED:
      // Lapsed customer: they need to pick a plan again. Free signup likewise.
      return { kind: 'choose_plan' }
    case ESubscriptionUiState.ACTIVE:
    case ESubscriptionUiState.TRIALING:
      return { kind: 'manage', portalDeepLink: PORTAL_DEEP_LINK }
    case ESubscriptionUiState.NONE:
    default:
      // No Stripe relationship yet (free) or unknown: drive an upgrade.
      return summary.hasStripeCustomer
        ? { kind: 'manage', portalDeepLink: PORTAL_DEEP_LINK }
        : { kind: 'choose_plan' }
  }
}
