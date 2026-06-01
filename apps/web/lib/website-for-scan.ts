import type { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'

// MARK: - Website-vs-report scope resolution
//
// A scan whose host is one of the viewer's tracked websites chats against a
// continuous website thread; any other scan chats against a one-off report
// thread. This resolves which, server-side: a websites row for the scan's host
// that is RLS-visible to the caller (i.e. in their workspace) means
// website-scoped. The read uses the session client so RLS does the ownership
// check — no row, or a signed-out viewer, means report-scoped (null).

export async function websiteIdForScanUrl(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  scanUrl: string,
): Promise<string | undefined> {
  const host = hostOf(scanUrl)
  if (host.length === 0) {
    return undefined
  }
  const { data } = await supabase
    .from('websites')
    .select('id')
    .eq('host', host)
    .limit(1)
    .maybeSingle()
  return data?.id ?? undefined
}
