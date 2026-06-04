'use server'

import { createServiceClient } from '@isreadyai/supabase'
import { revalidatePath } from 'next/cache'
import type { TActionResult } from '@/lib/action-result'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveWorkspaceId } from '@/lib/workspace'

// MARK: - Account & security server actions

// A single catch-all event_type row models the global "alerts on/off" switch;
// the alert engine (cron) checks it before inserting a notification.
const ALL_EVENTS = '*'

/** Global alerts switch: toggles in-app + email delivery for every event type. */
export async function setAlertsEnabled(enabled: boolean): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  const workspaceId = await getActiveWorkspaceId(session, user.id)
  if (workspaceId === null) {
    return { ok: false, error: 'no_workspace' }
  }
  const service = await createServiceClient()
  const { error } = await service.from('notification_preferences').upsert(
    {
      workspace_id: workspaceId,
      user_id: user.id,
      event_type: ALL_EVENTS,
      in_app: enabled,
      email: enabled,
    },
    { onConflict: 'workspace_id,user_id,event_type' },
  )
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard/settings')
  return { ok: true }
}

/** Whether the user has alerts enabled (defaults to on when no preference set). */
export async function getAlertsEnabled(): Promise<boolean> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return true
  }
  const { data } = await session
    .from('notification_preferences')
    .select('in_app')
    .eq('user_id', user.id)
    .eq('event_type', ALL_EVENTS)
    .maybeSingle()
  return data?.in_app ?? true
}

/**
 * Permanently deletes the account. IRREVERSIBLE.
 *
 * - Scans are kept and merely DISSOCIATED: scans.user_id / created_by /
 *   workspace_id are ON DELETE SET NULL, so the generic, account-agnostic scan
 *   data survives without any link to the person.
 * - Stripe: the customer is deleted (which cancels its subscriptions and removes
 *   billing PII) for the personal profile and every workspace the user solely
 *   owns, captured BEFORE the row cascade wipes the ids.
 * - Workspaces the user solely owns are deleted (cascading their domains and
 *   monitoring schedules); shared workspaces have ownership handed to the oldest
 *   remaining member so they are never orphaned.
 * - The auth user is then removed, cascading profile, api keys and memberships.
 */
export async function deleteAccount(): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  const userId = user.id
  const service = await createServiceClient()

  // Capture Stripe ids before the cascade removes the profile row.
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  const { data: memberships } = await service
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)

  const soleOwned: string[] = []
  for (const membership of memberships ?? []) {
    const { count } = await service
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', membership.workspace_id)
      .eq('status', 'active')
    if ((count ?? 0) <= 1) {
      soleOwned.push(membership.workspace_id)
    } else if (membership.role === 'owner') {
      // Hand the shared workspace to the oldest remaining ACTIVE member — never
      // promote a removed/inactive member, which would orphan a live workspace.
      const { data: heir } = await service
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', membership.workspace_id)
        .eq('status', 'active')
        .neq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (heir !== null) {
        const { error: heirError } = await service
          .from('workspace_members')
          .update({ role: 'owner' })
          .eq('id', heir.id)
        if (heirError !== null) {
          return { ok: false, error: 'delete_failed' }
        }
      }
    }
  }

  if (isStripeConfigured()) {
    const stripe = getStripe()
    const customerIds = new Set<string>()
    if (profile?.stripe_customer_id) {
      customerIds.add(profile.stripe_customer_id)
    }
    if (soleOwned.length > 0) {
      const { data: ws } = await service
        .from('workspaces')
        .select('stripe_customer_id')
        .in('id', soleOwned)
      for (const w of ws ?? []) {
        if (w.stripe_customer_id) {
          customerIds.add(w.stripe_customer_id)
        }
      }
    }
    for (const customerId of customerIds) {
      // Deleting the customer cancels its subscriptions; a missing customer is fine.
      await stripe.customers.del(customerId).catch(() => undefined)
    }
  }

  if (soleOwned.length > 0) {
    const { error: wsError } = await service.from('workspaces').delete().in('id', soleOwned)
    if (wsError !== null) {
      return { ok: false, error: 'delete_failed' }
    }
  }

  const { error } = await service.auth.admin.deleteUser(userId)
  if (error !== null) {
    return { ok: false, error: 'delete_failed' }
  }

  await session.auth.signOut()
  return { ok: true }
}
