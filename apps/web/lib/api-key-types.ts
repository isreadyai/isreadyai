import type { Tables, TablesInsert } from '@isreadyai/supabase'
import type { TPlan } from '@/lib/plans'

type TApiKeyRow = Tables<'api_keys'>

/**
 * `workspace_id` rides along so the funded-AI quota (see api-keys.ts) can be
 * scoped to the key's WORKSPACE — the plan ceiling is per-workspace, not
 * per-key, so every key minted under one workspace must share one bucket.
 * `null` for legacy keys minted before workspaces existed, which keep their
 * own independent per-key bucket.
 */
export interface IApiKey extends Pick<TApiKeyRow, 'id' | 'workspace_id'> {
  plan: TPlan
}

export interface IFixQuota {
  used: number
  limit: number
}

export type TFixRunInput = Pick<TablesInsert<'fix_runs'>, 'repo' | 'url' | 'patches'>

export interface IApiKeyView extends Pick<TApiKeyRow, 'id' | 'label'> {
  plan: TPlan
  createdAt: TApiKeyRow['created_at']
  prefix: TApiKeyRow['prefix']
  lastUsedAt: TApiKeyRow['last_used_at']
  used: IFixQuota['used']
  limit: IFixQuota['limit']
}

export interface IBadgeKeyView extends Pick<TApiKeyRow, 'id' | 'label'> {
  plan: TPlan
  domains: TApiKeyRow['badge_domains']
}
