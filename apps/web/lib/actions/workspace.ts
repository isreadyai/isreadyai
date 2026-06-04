'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { TActionResult } from '@/lib/action-result'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMemberRole, WORKSPACE_COOKIE } from '@/lib/workspace'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Switches the caller's active workspace after verifying their membership. */
export async function setActiveWorkspace(workspaceId: string): Promise<TActionResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }
  // Never trust the requested id: it must be a workspace the caller belongs to.
  const role = await getMemberRole(supabase, user.id, workspaceId)
  if (role === null) {
    return { ok: false, error: 'not_member' }
  }

  ;(await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  // Every dashboard page reads the active workspace in its server render.
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
