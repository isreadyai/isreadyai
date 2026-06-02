import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { ReportView } from '@/components/report/report-view'
import { getPlanPrices } from '@/lib/plan-prices'
import { ciScanIdForCommit } from '@/lib/ci-reports'
import { getScanStore } from '@/lib/scan-store'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { hostOf } from '@/lib/url'
import { websiteIdForScanUrl } from '@/lib/website-for-scan'
import { signProxyToken } from '@/lib/proxy-token'

// MARK: - CI report page (/report/gh/<slug>/<commit>)

/**
 * Permanent, shareable report for a CI scan at a specific commit. The slug is
 * stable across repo renames; we resolve it to the underlying persisted scan
 * and render the standard report view.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('report')
  return {
    title: t('title'),
    robots: { index: false, follow: true },
  }
}

export default async function CiReportPage({
  params,
}: {
  params: Promise<{ slug: string; commit: string }>
}) {
  const { slug, commit } = await params
  const scanId = await ciScanIdForCommit(decodeURIComponent(slug), decodeURIComponent(commit))
  if (scanId === null) {
    notFound()
  }
  const prices = await getPlanPrices((await headers()).get('x-vercel-ip-country'))
  const [websiteId, proxyToken] = await Promise.all([
    resolveWebsiteScope(scanId),
    resolveProxyToken(scanId),
  ])
  return (
    <>
      <SiteHeader />
      <main className="site-container max-w-4xl pt-26 pb-26">
        <Suspense fallback={null}>
          <ReportView
            key={scanId}
            id={scanId}
            prices={prices}
            websiteId={websiteId}
            proxyToken={proxyToken}
          />
        </Suspense>
      </main>
      <SiteFooter bottomInset />
    </>
  )
}

/** See report/[id]: website scope is resolved only for a signed-in viewer who
 * tracks this scan's host; RLS keeps the websites lookup to their workspace. */
async function resolveWebsiteScope(scanId: string): Promise<string | undefined> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return undefined
  }
  const record = await (await getScanStore()).get(scanId)
  if (record === null) {
    return undefined
  }
  return websiteIdForScanUrl(supabase, record.url)
}

async function resolveProxyToken(scanId: string): Promise<string | undefined> {
  const record = await (await getScanStore()).get(scanId)
  if (record === null) {
    return undefined
  }
  return signProxyToken(hostOf(record.url))
}
