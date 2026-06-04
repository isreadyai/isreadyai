import type { ICompareScan } from '@/components/dashboard/compare-client'
import { getTranslations } from 'next-intl/server'
import { isScanReport } from '@isreadyai/scanner'
import { createServiceClient } from '@isreadyai/supabase'
import { CompareClient } from '@/components/dashboard/compare-client'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { hostOf } from '@/lib/url'
import { EScanStatus } from '@/lib/scan-record'

export const dynamic = 'force-dynamic'

export default async function DashboardComparePage() {
  const t = await getTranslations('admin')
  const ctx = await resolveWorkspaceContext()
  const workspaceId = ctx?.workspaceId ?? null
  const service = await createServiceClient()

  const { data } =
    workspaceId === null
      ? { data: null }
      : await service
          .from('scans')
          .select('id, url, status, created_at, report, overall_score')
          .eq('workspace_id', workspaceId)
          .eq('status', EScanStatus.DONE)
          .order('created_at', { ascending: false })

  const scans: ICompareScan[] = (data ?? []).flatMap((scan) => {
    if (!isScanReport(scan.report)) {
      return []
    }
    return [
      {
        id: scan.id,
        host: hostOf(scan.url),
        createdAt: scan.created_at,
        overall: scan.overall_score ?? scan.report.overall,
        categories: scan.report.categories.map((category) => ({
          key: category.category,
          label: category.label,
          score: category.score,
        })),
        findings: scan.report.checks.map((check) => ({
          id: check.id,
          title: check.title,
          status: check.status,
        })),
      },
    ]
  })

  return (
    <DashboardPage
      title={t('compare')}
      description={t('compareDescription')}
      parents={[{ label: t('scans'), href: '/dashboard/scans' }]}
    >
      <CompareClient scans={scans} />
    </DashboardPage>
  )
}
