import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { hostOf } from '@/lib/url'

// MARK: - Website chat grounding
//
// A website thread grounds in the website's latest COMPLETED scan. Websites are
// workspace-owned but their scans are matched to the website by host on the
// owner's own scans (the same host match the website-detail page uses — scans
// carry no reliable website_id). So grounding resolves to: the requesting
// user's most recent scan of the website's host whose report + smart report are
// both ready. Membership is verified first so a user can never ground (or later
// persist) onto a website outside their workspace.

const SCAN_LOOKBACK = 60

export interface IWebsiteGrounding {
  /** The scan to load + ground the chat on. */
  scanId: string
  /** The website's host (persisted on the thread row). */
  host: string
}

/**
 * Resolve the grounding scan for a website thread, or null when the website is
 * not the user's, has no completed scan yet, or storage is unavailable.
 */
export async function resolveWebsiteGrounding(
  websiteId: string,
  userId: string,
): Promise<IWebsiteGrounding | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  const service = await createServiceClient()

  const { data: website } = await service
    .from('websites')
    .select('host, workspace_id')
    .eq('id', websiteId)
    .maybeSingle()
  if (website === null) {
    return null
  }

  const { data: membership } = await service
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', website.workspace_id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (membership === null) {
    return null
  }

  // Scans have no host column, so match in JS over the user's recent scans —
  // newest first, the first one of this host with a finished standard + smart
  // report is the grounding scan.
  const { data: scans } = await service
    .from('scans')
    .select('id, url, report, smart_report')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(SCAN_LOOKBACK)
  const grounding = (scans ?? []).find(
    (scan) =>
      hostOf(scan.url) === website.host && scan.report !== null && scan.smart_report !== null,
  )
  if (grounding === undefined) {
    return null
  }
  return { scanId: grounding.id, host: website.host }
}
