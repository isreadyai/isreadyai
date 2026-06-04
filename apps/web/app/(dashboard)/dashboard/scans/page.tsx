import type { IScanRow } from '@/components/dashboard/scans-table'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { gradeOf, isScanReport } from '@isreadyai/scanner'
import { createServiceClient } from '@isreadyai/supabase'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { ScanForm } from '@/components/scan-form'
import { ScansTable } from '@/components/dashboard/scans-table'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { hostOf } from '@/lib/url'

export const dynamic = 'force-dynamic'

export default async function DashboardScansPage() {
  const t = await getTranslations('admin')
  const td = await getTranslations('dashboard')

  const ctx = await resolveWorkspaceContext()
  const scans = ctx === null ? [] : await loadWorkspaceScans(ctx.workspaceId)

  const rows: IScanRow[] = scans.map((scan) => {
    const report = isScanReport(scan.report) ? scan.report : null
    // Prefer the materialized combined score; fall back to the base report's
    // overall for rows written before the summary columns existed.
    const overall = scan.overall_score ?? report?.overall ?? null
    return {
      id: scan.id,
      host: hostOf(scan.url),
      status: scan.status,
      createdAt: scan.created_at,
      overall,
      grade: overall === null ? null : gradeOf(overall),
      failed: report?.checks.filter((c) => c.status === 'fail').length ?? 0,
      warned: report?.checks.filter((c) => c.status === 'warn').length ?? 0,
      isDeep: scan.has_deep,
      isSmart: scan.has_smart,
    }
  })

  return (
    <DashboardPage title={t('scans')} description={t('scansDescription')}>
      <ScanForm size="sm" authenticated fullWidth />
      <div className="flex justify-end">
        <Link
          href="/dashboard/compare"
          className="text-site-muted hover:text-site-accent text-sm transition-colors"
        >
          {td('compareLink')}
        </Link>
      </div>
      <ScansTable rows={rows} />
    </DashboardPage>
  )
}

// Membership is proven by resolveWorkspaceContext; the service client reads the
// workspace's scans (RLS would also allow it, but we keep one read path).
async function loadWorkspaceScans(workspaceId: string) {
  const service = await createServiceClient()
  const { data } = await service
    .from('scans')
    .select('id, url, status, created_at, report, overall_score, has_deep, has_smart')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  return data ?? []
}
