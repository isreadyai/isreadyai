'use server'

import { validateScanInput } from '@isreadyai/scanner'
import { createServiceClient } from '@isreadyai/supabase'
import { revalidatePath } from 'next/cache'
import type { TActionResult } from '@/lib/action-result'
import type { IApiKey } from '@/lib/api-key-types'
import { badgeMarkdown, getBadgeSigningSecret } from '@/lib/badge-access'
import { planOrFree } from '@/lib/plans'
import { checkQuota } from '@/lib/entitlements'
import { hostOf } from '@/lib/url'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - Badge domain server action

/**
 * Ownership + Pro/Team gating run on the RLS-scoped session client; the
 * badge_domains write then runs on the service client. The returned markdown
 * embeds a deterministic token so the public /badge endpoint unlocks the badge.
 */

export type TClaimBadgeResult = TActionResult<{ markdown: string }>

export async function claimBadgeDomain(
  keyId: IApiKey['id'],
  domain: string,
): Promise<TClaimBadgeResult> {
  const session = await createServerSupabaseClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (user === null) {
    return { ok: false, error: 'unauthenticated' }
  }

  const validated = validateScanInput(domain)
  if (!validated.ok) {
    return { ok: false, error: 'invalid_domain' }
  }
  const host = hostOf(validated.url)

  const { data: key } = await session
    .from('api_keys')
    .select('id, plan, badge_domains, revoked_at')
    .eq('id', keyId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (key === null || key.revoked_at !== null) {
    return { ok: false, error: 'not_found' }
  }
  // The README badge is free for registered users; the plan only governs HOW
  // MANY sites you can track. Claiming an already-tracked host stays allowed.
  if (!key.badge_domains.includes(host)) {
    const quota = checkQuota(planOrFree(key.plan), 'maxDomains', key.badge_domains.length)
    if (!quota.allowed) {
      return { ok: false, error: 'upgrade_required' }
    }
  }

  const secret = getBadgeSigningSecret()
  if (secret === null) {
    return { ok: false, error: 'badge_unavailable' }
  }

  if (!key.badge_domains.includes(host)) {
    const service = await createServiceClient()
    const { error } = await service
      .from('api_keys')
      .update({ badge_domains: [...key.badge_domains, host] })
      .eq('id', keyId)
    if (error !== null) {
      return { ok: false, error: error.message }
    }
  }

  revalidatePath('/dashboard/websites')
  return { ok: true, markdown: badgeMarkdown(host, key.id, secret) }
}
