'use server'

import { createServiceClient } from '@isreadyai/supabase'
import { revalidatePath } from 'next/cache'
import type { TActionResult } from '@/lib/action-result'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - Notification server actions (alerts inbox)
//
// Reads run on the RLS-scoped session client (a user only sees their own +
// workspace-wide notifications); the read_at write runs on the service client,
// matching the rest of the dashboard actions.

export async function markNotificationRead(id: string): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  // RLS exposes workspace-wide AND teammates' targeted notifications, so a read
  // alone isn't enough: only mark one that is the caller's own or workspace-wide
  // (user_id null) — never a teammate's targeted row.
  const { data: row } = await session
    .from('notifications')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (row === null) {
    return { ok: false, error: 'not_found' }
  }
  if (row.user_id !== null && row.user_id !== user.id) {
    return { ok: false, error: 'not_found' }
  }
  const service = await createServiceClient()
  const { error } = await service
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error !== null) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard/alerts')
  return { ok: true }
}

export async function markAllNotificationsRead(): Promise<TActionResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  // Resolve the unread ids the caller can see (RLS), keep only their own +
  // workspace-wide (user_id null) ones, then service-update those — never clear a
  // teammate's targeted notification.
  const { data: rows } = await session
    .from('notifications')
    .select('id, user_id')
    .is('read_at', null)
  const ids = (rows ?? [])
    .filter((row) => row.user_id === null || row.user_id === user.id)
    .map((row) => row.id)
  if (ids.length > 0) {
    const service = await createServiceClient()
    const { error } = await service
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
    if (error !== null) {
      return { ok: false, error: error.message }
    }
  }
  revalidatePath('/dashboard/alerts')
  return { ok: true }
}
