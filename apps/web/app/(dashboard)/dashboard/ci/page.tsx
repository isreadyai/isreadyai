import type { ICiRepoTableRow } from '@/components/dashboard/ci-repos-table'
import { getTranslations } from 'next-intl/server'
import { CiReposTable } from '@/components/dashboard/ci-repos-table'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { ciBadgeLinks, ciReposForWorkspace } from '@/lib/ci-reports'
import { resolveWorkspaceContext } from '@/lib/workspace-context'

export const dynamic = 'force-dynamic'

export default async function DashboardCiPage() {
  const t = await getTranslations('admin')
  const ctx = await resolveWorkspaceContext()
  const repos = ctx === null ? [] : await ciReposForWorkspace(ctx.workspaceId)

  const rows: ICiRepoTableRow[] = repos.map((repo) => {
    const report = repo.latestReport
    const reportPath =
      report === null ? null : `/report/gh/${repo.slug}/${encodeURIComponent(report.commit)}`
    const badgeMarkdown =
      report === null ? null : ciBadgeLinks(repo.slug, report.branch, report.commit).badgeMarkdown

    return {
      slug: repo.slug,
      ownerRepo: repo.ownerRepo,
      branch: report?.branch ?? null,
      commit: report?.commit ?? null,
      overall: report?.score ?? null,
      failed: report?.failed ?? 0,
      warned: report?.warned ?? 0,
      isDeep: report?.isDeep ?? false,
      isSmart: report?.isSmart ?? false,
      createdAt: report?.createdAt ?? null,
      reportPath,
      badgeMarkdown,
    }
  })

  return (
    <DashboardPage title={t('ci')} description={t('ciDescription')}>
      <CiReposTable rows={rows} />
    </DashboardPage>
  )
}
