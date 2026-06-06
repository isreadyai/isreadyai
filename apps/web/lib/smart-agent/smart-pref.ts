import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'

// MARK: - Per-domain Smart Agent preference

/**
 * Whether the Smart Agent pass should run for this scan. A signed-in owner can
 * turn it off per-domain (monitoring_schedules.smart_agent_enabled, surfaced as
 * the "Smart agent readability" switch). Anonymous scans, sites the caller
 * doesn't own, and domains without a monitoring schedule always run it.
 */
export async function smartAgentEnabledForScan(url: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user === null) {
      return true
    }
    // RLS scopes this to the caller's workspace, so a hit is genuinely theirs.
    const { data: domain } = await supabase
      .from('websites')
      .select('id')
      .eq('host', hostOf(url))
      .maybeSingle()
    if (domain === null) {
      return true
    }
    const { data: schedule } = await supabase
      .from('monitoring_schedules')
      .select('smart_agent_enabled')
      .eq('website_id', domain.id)
      .maybeSingle()
    return schedule?.smart_agent_enabled ?? true
  } catch {
    return true
  }
}
