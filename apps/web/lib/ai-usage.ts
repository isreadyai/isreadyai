import { createServiceClient } from '@isreadyai/supabase'

// MARK: - AI usage metering
//
// Thin server-only wrapper over the public.ai_usage ledger (service role).
// It only RECORDS and READS — it never decides policy. Callers gate on the
// returned totals against their entitlement (e.g. chatMessagesPerMonth) and
// choose their own fail-open / fail-closed behaviour. Both functions throw on
// a DB error so a caller can treat a metering failure as a hard deny if it
// must fail closed.

export type TUsageSurface = 'chat' | 'mcp' | 'solve'

export interface IRecordUsageInput {
  surface: TUsageSurface
  /** Session owner (chat). Set this OR apiKeyId. */
  userId?: string | null
  /** API-key owner (mcp / solve). Set this OR userId. */
  apiKeyId?: string | null
  /** Provider generation id — makes the write idempotent. Omit for none. */
  generationId?: string | null
  messages?: number
  tokens?: number
}

export interface IUsageTotals {
  messages: number
  tokens: number
}

/** A usage event is attributed to exactly one principal. */
export type TOwnerRef = { userId: string } | { apiKeyId: string }

/** Current (or given) instant as a UTC calendar-month bucket, 'YYYYMM'. */
export function monthKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

/**
 * Record one usage event in the current UTC month bucket. Idempotent when a
 * generationId is supplied: the same generationId is recorded at most once, so
 * retries never double-count. Without a generationId every call accumulates.
 */
export async function recordUsage(input: IRecordUsageInput): Promise<void> {
  if (
    (input.userId === null || input.userId === undefined) &&
    (input.apiKeyId === null || input.apiKeyId === undefined)
  ) {
    throw new Error('recordUsage requires a userId or an apiKeyId')
  }

  const service = await createServiceClient()
  const { error } = await service.rpc('record_ai_usage', {
    p_surface: input.surface,
    p_period: monthKey(),
    p_user_id: input.userId ?? undefined,
    p_api_key_id: input.apiKeyId ?? undefined,
    p_generation_id: input.generationId ?? undefined,
    p_messages: input.messages ?? 0,
    p_tokens: input.tokens ?? 0,
  })
  if (error !== null) {
    throw new Error(`record_ai_usage failed: ${error.message}`)
  }
}

/** This-month totals for an owner on a surface. Zeroes when there are no rows. */
export async function usageThisMonth(
  surface: TUsageSurface,
  owner: TOwnerRef,
): Promise<IUsageTotals> {
  const ownerId = 'userId' in owner ? owner.userId : owner.apiKeyId
  const service = await createServiceClient()
  const { data, error } = await service.rpc('ai_usage_this_month', {
    p_surface: surface,
    p_owner: ownerId,
    p_period: monthKey(),
  })
  if (error !== null) {
    throw new Error(`ai_usage_this_month failed: ${error.message}`)
  }
  const row = data?.[0]
  return { messages: row?.messages ?? 0, tokens: row?.tokens ?? 0 }
}
