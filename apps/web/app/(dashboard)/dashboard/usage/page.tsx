import type { IFixRunRow } from '@/components/dashboard/fix-runs-table'
import type { IUsageTotals } from '@/lib/ai-usage'
import { getTranslations } from 'next-intl/server'
import { Card } from '@heroui/react/card'
import { createServiceClient } from '@isreadyai/supabase'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { FixRunsTable } from '@/components/dashboard/fix-runs-table'
import { UsageMeter } from '@/components/ui/usage-meter'
import { resolveWorkspaceContext } from '@/lib/workspace-context'
import { usageThisMonth } from '@/lib/ai-usage'
import { resolveEntitlements } from '@/lib/entitlements'
import { planOrFree } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export default async function DashboardUsagePage() {
  const t = await getTranslations('admin')
  const td = await getTranslations('dashboard')
  const ctx = await resolveWorkspaceContext()
  const workspaceId = ctx?.workspaceId ?? null
  const memberIds = ctx?.memberIds ?? []
  const entitlements = resolveEntitlements(planOrFree(ctx?.ownerPlan))

  const service = await createServiceClient()
  // Fix-PR runs are attributed to the active workspace's api keys.
  const { data: keys } =
    workspaceId === null
      ? { data: null }
      : await service
          .from('api_keys')
          .select('id')
          .eq('workspace_id', workspaceId)
          .is('revoked_at', null)
  const keyIds = (keys ?? []).map((key) => key.id)

  let used = 0
  let runs: IFixRunRow[] = []
  if (keyIds.length > 0) {
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const { count } = await service
      .from('fix_runs')
      .select('id', { count: 'exact', head: true })
      .in('api_key_id', keyIds)
      .gte('created_at', since)
    used = count ?? 0
    const { data } = await service
      .from('fix_runs')
      .select('id, repo, url, patches, created_at')
      .in('api_key_id', keyIds)
      .order('created_at', { ascending: false })
      .limit(50)
    runs = data ?? []
  }

  // Chat usage is per-user; sum it across the workspace's members.
  let chatUsage: IUsageTotals = { messages: 0, tokens: 0 }
  for (const memberId of memberIds) {
    try {
      const totals = await usageThisMonth('chat', { userId: memberId })
      chatUsage = {
        messages: chatUsage.messages + totals.messages,
        tokens: chatUsage.tokens + totals.tokens,
      }
    } catch {
      // A single member's metering hiccup shouldn't blank the whole page.
    }
  }

  return (
    <DashboardPage title={t('usage')} description={t('usageDescription')}>
      <div className="space-y-6">
        {entitlements.maxMembers > 1 ? (
          <div className="border-site-secondary/40 bg-site-secondary/8 rounded-2xl border p-5">
            <p className="text-site-secondary text-sm font-semibold">{td('usageSharedTitle')}</p>
            <p className="text-site-muted mt-1 text-sm leading-relaxed">{td('usageSharedBody')}</p>
          </div>
        ) : null}

        <Card className="border-site-border bg-site-surface/60 border">
          <Card.Content>
            <UsageMeter
              label={td('usageLabel')}
              used={used}
              limit={entitlements.fixRunsPerPeriod}
              unit={td('usageUnit')}
            />
          </Card.Content>
        </Card>

        <Card className="border-site-border bg-site-surface/60 border">
          <Card.Content>
            <UsageMeter
              label={td('usageChatLabel')}
              used={chatUsage.messages}
              limit={entitlements.chatMessagesPerMonth}
              unit={td('usageChatUnit')}
            />
            <p className="text-site-faint mt-2 text-xs">
              {td('usageChatTokens', { tokens: chatUsage.tokens.toLocaleString() })}
            </p>
          </Card.Content>
        </Card>

        <div className="space-y-3">
          <p className="text-site-text text-sm font-semibold">{td('usageRunsTitle')}</p>
          <FixRunsTable runs={runs} />
        </div>
      </div>
    </DashboardPage>
  )
}
