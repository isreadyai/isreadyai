import type { Json, Tables, TablesUpdate } from '@isreadyai/supabase'
import type { IScanRecord, TScanRecordPatch } from '@/lib/scan-record'

import {
  isScanReport,
  isSiteReport,
  isSmartAgentReport,
  isSmartAgentSiteReport,
} from '@isreadyai/scanner'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { EScanStatus, ESmartScanStatus, isScanStatus, isSmartScanStatus } from '@/lib/scan-record'
import { scanSummaryColumns } from '@/lib/score'

// MARK: - Scan store

/**
 * No Supabase env: scans live in memory. With Supabase env: same interface,
 * persisted to Postgres. The interface is identical so callers never know
 * which backend is live.
 */

type TScanRow = Tables<'scans'>
type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/**
 * Recompute and persist a scan's materialized summary columns (overall_score,
 * has_deep, has_smart) from its stored report jsonb — the cheap fields the
 * dashboard lists read. Best-effort: a failure leaves the cache stale (the report
 * page still recomputes from jsonb) but never breaks the scan write. Call after
 * any score-relevant write (store update, cron, CI).
 */
export async function materializeScanSummary(client: TServiceClient, id: string): Promise<void> {
  const { data } = await client
    .from('scans')
    .select('report, site_report, smart_report, smart_site_report')
    .eq('id', id)
    .maybeSingle()
  if (data === null) {
    return
  }
  await client.from('scans').update(scanSummaryColumns(data)).eq('id', id)
}

export interface IScanStore {
  /**
   * ipHash is stored for rate limiting only — never exposed on IScanRecord.
   * userId attributes the scan to a signed-in account; null for anonymous runs.
   */
  create(
    url: TScanRow['url'],
    ipHash: TScanRow['ip_hash'],
    userId: TScanRow['user_id'],
    source?: TScanRow['source'],
    workspaceId?: TScanRow['workspace_id'],
  ): Promise<IScanRecord>
  get(id: TScanRow['id']): Promise<IScanRecord | null>
  /**
   * Ownership of a scan row, used by the API to gate reads/writes. null when no
   * such row exists; both fields null for an anonymous (public-by-id) scan.
   */
  getOwner(
    id: TScanRow['id'],
  ): Promise<{ userId: TScanRow['user_id']; workspaceId: TScanRow['workspace_id'] } | null>
  update(id: TScanRow['id'], patch: TScanRecordPatch): Promise<void>
  /** Permanently removes a scan. Ownership is enforced by the caller. */
  delete(id: TScanRow['id']): Promise<void>
  /** Scans created by this ipHash within the window — durable rate limiting. */
  recentCountByIp(ipHash: NonNullable<TScanRow['ip_hash']>, windowMs: number): Promise<number>
  /** Total completed scans — the basis for the cumulative "checks performed" stat. */
  countCompletedScans(): Promise<number>
}

// MARK: - In-memory backend

const MEMORY_TTL_MS = 60 * 60 * 1000
const memory = new Map<TScanRow['id'], IScanRecord>()
const memoryIpLog = new Map<NonNullable<TScanRow['ip_hash']>, number[]>()

function pruneMemory(): void {
  const cutoff = Date.now() - MEMORY_TTL_MS
  for (const [id, record] of memory) {
    if (new Date(record.createdAt).getTime() < cutoff) {
      memory.delete(id)
    }
  }
  for (const [ip, times] of memoryIpLog) {
    const kept = times.filter((t) => t > cutoff)
    if (kept.length === 0) {
      memoryIpLog.delete(ip)
    } else {
      memoryIpLog.set(ip, kept)
    }
  }
}

const memoryStore: IScanStore = {
  create(
    url: TScanRow['url'],
    ipHash: TScanRow['ip_hash'],
    _userId: TScanRow['user_id'],
    _source?: TScanRow['source'],
    _workspaceId?: TScanRow['workspace_id'],
  ): Promise<IScanRecord> {
    pruneMemory()
    const record: IScanRecord = {
      id: crypto.randomUUID(),
      url,
      status: EScanStatus.QUEUED,
      report: null,
      siteReport: null,
      error: null,
      smartStatus: ESmartScanStatus.QUEUED,
      smartReport: null,
      siteSmartReport: null,
      smartError: null,
      createdAt: new Date().toISOString(),
    }
    memory.set(record.id, record)
    if (ipHash !== null) {
      memoryIpLog.set(ipHash, [...(memoryIpLog.get(ipHash) ?? []), Date.now()])
    }
    return Promise.resolve(record)
  },
  get(id: TScanRow['id']): Promise<IScanRecord | null> {
    return Promise.resolve(memory.get(id) ?? null)
  },
  getOwner(
    id: TScanRow['id'],
  ): Promise<{ userId: TScanRow['user_id']; workspaceId: TScanRow['workspace_id'] } | null> {
    // The in-memory backend does not record ownership, so every stored scan is
    // anonymous (public-by-id) — the local-dev contract.
    return Promise.resolve(memory.has(id) ? { userId: null, workspaceId: null } : null)
  },
  update(id, patch): Promise<void> {
    const record = memory.get(id)
    if (record !== undefined) {
      memory.set(id, { ...record, ...patch })
    }
    return Promise.resolve()
  },
  delete(id): Promise<void> {
    memory.delete(id)
    return Promise.resolve()
  },
  recentCountByIp(ipHash: NonNullable<TScanRow['ip_hash']>, windowMs: number): Promise<number> {
    const since = Date.now() - windowMs
    return Promise.resolve((memoryIpLog.get(ipHash) ?? []).filter((t) => t > since).length)
  },
  countCompletedScans(): Promise<number> {
    let done = 0
    for (const record of memory.values()) {
      if (record.status === EScanStatus.DONE) {
        done += 1
      }
    }
    return Promise.resolve(done)
  },
}

// MARK: - Supabase backend

async function createSupabaseStore(): Promise<IScanStore> {
  const client = await createServiceClient()

  return {
    async create(
      url: TScanRow['url'],
      ipHash: TScanRow['ip_hash'],
      userId: TScanRow['user_id'],
      source?: TScanRow['source'],
      workspaceId?: TScanRow['workspace_id'],
    ): Promise<IScanRecord> {
      const record: IScanRecord = {
        id: crypto.randomUUID(),
        url,
        status: EScanStatus.QUEUED,
        report: null,
        siteReport: null,
        error: null,
        smartStatus: ESmartScanStatus.QUEUED,
        smartReport: null,
        siteSmartReport: null,
        smartError: null,
        createdAt: new Date().toISOString(),
      }
      const { error } = await client.from('scans').insert({
        id: record.id,
        url: record.url,
        status: record.status,
        ip_hash: ipHash,
        user_id: userId,
        created_by: userId,
        workspace_id: workspaceId ?? null,
        source: source ?? null,
        created_at: record.createdAt,
      })
      if (error !== null) {
        throw new Error(`scan insert failed: ${error.message}`)
      }
      return record
    },
    async get(id: string): Promise<IScanRecord | null> {
      const { data, error } = await client.from('scans').select('*').eq('id', id).maybeSingle()
      if (error !== null || data === null) {
        return null
      }
      if (!isScanStatus(data.status) || !isSmartScanStatus(data.smart_status)) {
        return null
      }
      return {
        id: data.id,
        url: data.url,
        status: data.status,
        report: isScanReport(data.report) ? data.report : null,
        siteReport: isSiteReport(data.site_report) ? data.site_report : null,
        error: data.error,
        smartStatus: data.smart_status,
        smartReport: isSmartAgentReport(data.smart_report) ? data.smart_report : null,
        siteSmartReport: isSmartAgentSiteReport(data.smart_site_report)
          ? data.smart_site_report
          : null,
        smartError: data.smart_error,
        createdAt: data.created_at,
      }
    },
    async getOwner(
      id: string,
    ): Promise<{ userId: TScanRow['user_id']; workspaceId: TScanRow['workspace_id'] } | null> {
      const { data, error } = await client
        .from('scans')
        .select('user_id, workspace_id')
        .eq('id', id)
        .maybeSingle()
      if (error !== null || data === null) {
        return null
      }
      return { userId: data.user_id, workspaceId: data.workspace_id }
    },
    async update(id, patch): Promise<void> {
      const update: TablesUpdate<'scans'> = {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.report !== undefined ? { report: toJson(patch.report) } : {}),
        ...(patch.siteReport !== undefined ? { site_report: toJson(patch.siteReport) } : {}),
        ...(patch.error !== undefined ? { error: patch.error } : {}),
        ...(patch.smartStatus !== undefined ? { smart_status: patch.smartStatus } : {}),
        ...(patch.smartReport !== undefined ? { smart_report: toJson(patch.smartReport) } : {}),
        ...(patch.siteSmartReport !== undefined
          ? { smart_site_report: toJson(patch.siteSmartReport) }
          : {}),
        ...(patch.smartError !== undefined ? { smart_error: patch.smartError } : {}),
      }
      const { error } = await client.from('scans').update(update).eq('id', id)
      if (error !== null) {
        throw new Error(`scan update failed: ${error.message}`)
      }
      // Refresh the materialized summary whenever a score-relevant field changed.
      if (
        patch.report !== undefined ||
        patch.siteReport !== undefined ||
        patch.smartReport !== undefined ||
        patch.siteSmartReport !== undefined
      ) {
        await materializeScanSummary(client, id)
      }
    },
    async delete(id: string): Promise<void> {
      const { error } = await client.from('scans').delete().eq('id', id)
      if (error !== null) {
        throw new Error(`scan delete failed: ${error.message}`)
      }
    },
    async recentCountByIp(ipHash: string, windowMs: number): Promise<number> {
      const since = new Date(Date.now() - windowMs).toISOString()
      const { count, error } = await client
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', since)
      if (error !== null || count === null) {
        // Fail closed: an unconsultable limiter must block, not wave through
        // unbounded headless-browser scans. The caller maps this to a 429.
        throw new Error(`scan rate-limit count failed: ${error?.message ?? 'null count'}`)
      }
      return count
    },
    async countCompletedScans(): Promise<number> {
      const { count, error } = await client
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('status', EScanStatus.DONE)
      return error !== null || count === null ? 0 : count
    },
  }
}

// MARK: - Resolution

let resolved: Promise<IScanStore> | null = null

export function getScanStore(): Promise<IScanStore> {
  resolved ??= isSupabaseConfigured() ? createSupabaseStore() : Promise.resolve(memoryStore)
  return resolved
}

function toJson(value: object | null): Json {
  return value as unknown as Json
}
