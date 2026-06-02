import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@isreadyai/supabase'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { ReportView } from '@/components/report/report-view'
import { getPlanPrices } from '@/lib/plan-prices'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'
import { websiteIdForScanUrl } from '@/lib/website-for-scan'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { signProxyToken } from '@/lib/proxy-token'

// MARK: - Report page (public / shareable view)

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('report')
  return {
    title: t('title'),
    robots: { index: false, follow: true },
  }
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prices = await getPlanPrices((await headers()).get('x-vercel-ip-country'))
  // A signed-in owner is sent to the premium, owner-scoped dashboard report; this
  // public view is for anonymous visitors and shared / other-workspace links.
  const { websiteId, shared, scanUrl } = await resolveViewerScope(id)
  // Shared reports are read-only (deep scan blocked by the `shared` prop) — no token needed.
  const proxyToken = !shared && scanUrl !== undefined ? signProxyToken(hostOf(scanUrl)) : undefined
  return (
    <>
      <SiteHeader />
      <main className="site-container max-w-4xl pt-26 pb-10">
        <Suspense fallback={null}>
          <ReportView
            key={id}
            id={id}
            prices={prices}
            websiteId={websiteId}
            shared={shared}
            proxyToken={proxyToken}
          />
        </Suspense>
      </main>
      <SiteFooter bottomInset />
    </>
  )
}

/**
 * Redirects a signed-in viewer who OWNS this scan to the premium, owner-scoped
 * dashboard report — which unlocks the fix plan, Ask-your-site chat and badge for
 * Pro/Team via the workspace owner's plan. For everyone else it returns:
 *   • `websiteId` — the tracked-website id so the chat can scope to it (signed-in
 *     non-owners only; undefined for anonymous visitors, chat locked).
 *   • `shared` — true when the scan has a registered owner, i.e. this is a shared
 *     link the viewer didn't run. Drives hiding the owner-only Save / full-scan
 *     upsells. Only the boolean leaves the server — never the owner's user_id.
 * Ownership matches the dashboard report's own check, so the two never bounce
 * between each other.
 */
async function resolveViewerScope(
  scanId: string,
): Promise<{ websiteId?: string; shared: boolean; scanUrl?: string }> {
  // Service read: a teammate's scan is user-keyed and hidden by RLS; ownership is
  // proven by workspace membership (ctx) rather than by the row being readable.
  // Read before the anonymous early-return so `shared` is known regardless of auth.
  const service = await createServiceClient()
  const { data: scan } = await service
    .from('scans')
    .select('url, user_id, workspace_id')
    .eq('id', scanId)
    .maybeSingle()
  if (scan === null) {
    return { shared: false }
  }
  const scanUrl = scan.url
  const shared = scan.user_id !== null
  const ctx = await resolveWorkspaceContext()
  if (ctx === null) {
    return { shared, scanUrl }
  }
  const owned =
    (scan.workspace_id !== null && scan.workspace_id === ctx.workspaceId) ||
    scan.user_id === ctx.userId
  if (owned) {
    redirect(`/dashboard/scans/${scanId}`)
  }
  const supabase = await createServerSupabaseClient()
  const websiteId = await websiteIdForScanUrl(supabase, scan.url)
  return { websiteId, shared, scanUrl }
}
