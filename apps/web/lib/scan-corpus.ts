import type { Tables } from '@isreadyai/supabase'
import type { TGrade, TStatus } from '@isreadyai/scanner'
import { unstable_cache } from 'next/cache'
import { EGrade, EStatus, gradeOf } from '@isreadyai/scanner'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { EScanStatus } from '@/lib/scan-record'

// MARK: - Live scan corpus stats

type TScanRow = Tables<'scans'>

/** Minimum deduplicated sites before any corpus statistic is published. */
export const CORPUS_MIN_SITES = 30

const UA_BLOCKING_CHECK_ID = 'crawler.ua-blocking'
const PAGE_SIZE = 1000
const MAX_ROWS = 5000
const STATUSES = new Set<string>(Object.values(EStatus))

/** Per-check tally across the corpus; informational results are not counted. */
export interface ICorpusCheckCounts {
  id: string
  sites: number
  fail: number
  warn: number
}

/** Aggregate statistics over each host's latest on-demand scan. */
export interface ICorpusStats {
  sites: number
  from: string
  to: string
  medianScore: number
  grades: Record<TGrade, number>
  uaRefused: { sites: number; refused: number }
  checks: ICorpusCheckCounts[]
}

/** One scan reduced to the fields the corpus statistics need. */
export interface ICorpusRow {
  host: NonNullable<TScanRow['host']>
  createdAt: TScanRow['created_at']
  overall: NonNullable<TScanRow['overall_score']>
  checks: unknown
}

interface IParsedCheck {
  id: string
  status: TStatus
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStatus(value: unknown): value is TStatus {
  return typeof value === 'string' && STATUSES.has(value)
}

function parseChecks(checks: unknown): IParsedCheck[] {
  if (!Array.isArray(checks)) {
    return []
  }
  const parsed: IParsedCheck[] = []
  for (const entry of checks) {
    if (isRecord(entry) && typeof entry.id === 'string' && isStatus(entry.status)) {
      parsed.push({ id: entry.id, status: entry.status })
    }
  }
  return parsed
}

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  const lower = sorted[mid - 1] ?? upper
  return Math.round(sorted.length % 2 === 1 ? upper : (lower + upper) / 2)
}

/** Reduces newest-first scan rows to per-host latest statistics; null below the minimum sample. */
export function summarizeCorpus(rows: readonly ICorpusRow[]): ICorpusStats | null {
  const latest = new Map<string, ICorpusRow>()
  for (const row of rows) {
    if (!latest.has(row.host)) {
      latest.set(row.host, row)
    }
  }
  if (latest.size < CORPUS_MIN_SITES) {
    return null
  }

  const grades: Record<TGrade, number> = {
    [EGrade.EXCELLENT]: 0,
    [EGrade.GOOD]: 0,
    [EGrade.MODERATE]: 0,
    [EGrade.POOR]: 0,
  }
  const uaRefused = { sites: 0, refused: 0 }
  const checkCounts = new Map<string, ICorpusCheckCounts>()
  const scores: number[] = []
  let from = ''
  let to = ''

  for (const row of latest.values()) {
    scores.push(row.overall)
    if (from === '' || new Date(row.createdAt) < new Date(from)) {
      from = row.createdAt
    }
    if (to === '' || new Date(row.createdAt) > new Date(to)) {
      to = row.createdAt
    }
    grades[gradeOf(row.overall)] += 1
    for (const check of parseChecks(row.checks)) {
      if (check.status === EStatus.INFO) {
        continue
      }
      const counts = checkCounts.get(check.id) ?? { id: check.id, sites: 0, fail: 0, warn: 0 }
      counts.sites += 1
      if (check.status === EStatus.FAIL) {
        counts.fail += 1
      } else if (check.status === EStatus.WARN) {
        counts.warn += 1
      }
      checkCounts.set(check.id, counts)
      if (check.id === UA_BLOCKING_CHECK_ID) {
        uaRefused.sites += 1
        if (check.status === EStatus.FAIL || check.status === EStatus.WARN) {
          uaRefused.refused += 1
        }
      }
    }
  }

  return {
    sites: latest.size,
    from,
    to,
    medianScore: median(scores.toSorted((a, b) => a - b)),
    grades,
    uaRefused,
    checks: [...checkCounts.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
  }
}

async function fetchCorpusRows(): Promise<ICorpusRow[] | null> {
  const client = await createServiceClient()
  const rows: ICorpusRow[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('scans')
      .select('host, created_at, overall_score, checks:report->checks')
      .eq('status', EScanStatus.DONE)
      .not('overall_score', 'is', null)
      .not('host', 'is', null)
      .or('source.is.null,source.neq.cron')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error !== null) {
      return null
    }
    for (const row of data) {
      if (row.host !== null && row.overall_score !== null) {
        rows.push({
          host: row.host,
          createdAt: row.created_at,
          overall: row.overall_score,
          checks: row.checks,
        })
      }
    }
    if (data.length < PAGE_SIZE) {
      break
    }
  }
  return rows
}

const getCachedCorpusStats = unstable_cache(
  async (): Promise<ICorpusStats | null> => {
    try {
      const rows = await fetchCorpusRows()
      return rows === null ? null : summarizeCorpus(rows)
    } catch {
      return null
    }
  },
  ['scan-corpus-stats-v1'],
  { revalidate: 3600 },
)

/** Cached corpus statistics; null when Supabase is unconfigured, the fetch fails, or the sample is too small. */
export async function loadCorpusStats(): Promise<ICorpusStats | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  return getCachedCorpusStats()
}
