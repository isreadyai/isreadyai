import type { Tables } from '@isreadyai/supabase'
import type { IApiKeyView } from '@/lib/api-key-types'
import { createServiceClient } from '@isreadyai/supabase'
import { getTranslations } from 'next-intl/server'
import { ApiKeysClient } from '@/components/dashboard/api-keys-client'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { RestrictedNotice } from '@/components/dashboard/restricted-notice'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { isWorkspaceManager } from '@/lib/workspace'
import { PLAN_FIX_QUOTA, planOrFree } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const QUOTA_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export default async function DashboardApiKeysPage() {
  const t = await getTranslations('admin')

  const ctx = await resolveWorkspaceContext()
  if (ctx === null || !isWorkspaceManager(ctx.role)) {
    return (
      <DashboardPage title={t('apiKeys')} description={t('apiKeysDescription')}>
        <RestrictedNotice />
      </DashboardPage>
    )
  }

  // Keys belong to the active workspace; owner/admin membership is already proven.
  const service = await createServiceClient()
  const { data } = await service
    .from('api_keys')
    .select('id, label, plan, created_at, prefix, last_used_at')
    .eq('workspace_id', ctx.workspaceId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  const rows = data ?? []
  const usageByKey = await fixRunsByKey(rows.map((r) => r.id))

  const keys: IApiKeyView[] = rows.map((row) => {
    const plan = planOrFree(row.plan)
    return {
      id: row.id,
      label: row.label,
      plan,
      createdAt: row.created_at,
      prefix: row.prefix,
      lastUsedAt: row.last_used_at,
      used: usageByKey.get(row.id) ?? 0,
      limit: PLAN_FIX_QUOTA[plan],
    }
  })

  return (
    <DashboardPage title={t('apiKeys')} description={t('apiKeysDescription')}>
      <ApiKeysClient keys={keys} />
    </DashboardPage>
  )
}

async function fixRunsByKey(
  keyIds: Tables<'api_keys'>['id'][],
): Promise<Map<Tables<'api_keys'>['id'], number>> {
  const usage = new Map<Tables<'api_keys'>['id'], number>()
  if (keyIds.length === 0) {
    return usage
  }
  const service = await createServiceClient()
  const since = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString()
  const { data } = await service
    .from('fix_runs')
    .select('api_key_id')
    .in('api_key_id', keyIds)
    .gte('created_at', since)
  for (const run of data ?? []) {
    usage.set(run.api_key_id, (usage.get(run.api_key_id) ?? 0) + 1)
  }
  return usage
}
