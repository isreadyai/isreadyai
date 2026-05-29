import type {
  ICheck,
  ICheckResult,
  IFetchProvider,
  IRawResponse,
  IScanContext,
  IScanOptions,
  IScanReport,
  TUrl,
} from './types.ts'
import { EStatus } from './types.ts'
import { NativeProvider } from './providers/native.ts'
import { gradeOf, overallScore, SCORE_VERSION, scoreCategories } from './score.ts'
import { normalizeUrl } from './util/url.ts'
import { structuralFingerprint } from './smart-agent/structural-cluster.ts'

/**
 * Scan engine: orchestrates a single-page audit by fetching the URL once and
 * running all checks in parallel against shared cached context.
 */

// MARK: - Engine

/**
 * Scans a single URL: raw HTTP fetch + parallel checks with cached fetch context.
 *
 * A crashing check returns ERROR with zero weight instead of throwing, ensuring
 * one broken check doesn't fail the entire scan.
 *
 * @param {string} inputUrl - The URL to scan (normalized internally).
 * @param {IScanOptions} options - Scan configuration (checks, fetch providers, progress callback).
 * @returns {Promise<IScanReport>} - Complete audit report with category scores and check results.
 * @async
 * @export
 */
export async function scan(inputUrl: string, options: IScanOptions): Promise<IScanReport> {
  const startedAt = new Date()
  const url = normalizeUrl(inputUrl)
  const providers: IFetchProvider[] = options.providers ?? [new NativeProvider()]
  const native = providers[0] ?? new NativeProvider()
  const log = options.onProgress ?? (() => undefined)

  log(`Fetching ${url}`)
  const raw = await native.rawFetch(url)

  const cache = new Map<string, Promise<IRawResponse>>()
  const cachedFetch = (target: TUrl, headers?: Record<string, string>): Promise<IRawResponse> => {
    const key = headers === undefined ? target : `${target}|${JSON.stringify(headers)}`
    const existing = cache.get(key)
    if (existing !== undefined) {
      return existing
    }
    const pending = native.rawFetch(target, headers)
    cache.set(key, pending)
    return pending
  }
  const ctx: IScanContext = {
    url,
    raw,
    providers,
    fetchCached: (target) => cachedFetch(target),
    fetchWith: (target, headers) => cachedFetch(target, headers),
    log,
  }

  log(`Running ${options.checks.length} checks`)
  const results = await Promise.all(options.checks.map((check) => runSafely(check, ctx)))

  const categories = scoreCategories(results)
  const overall = overallScore(categories)
  const finishedAt = new Date()

  return {
    url,
    finalUrl: raw.finalUrl,
    scoreVersion: SCORE_VERSION,
    overall,
    grade: gradeOf(overall),
    categories,
    checks: results,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    meta: {
      renderProvider: null,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      fetchOk: raw.error === undefined && raw.status > 0,
      error: raw.error,
    },
    fingerprint: structuralFingerprint(raw.body),
  }
}

// MARK: - internal

async function runSafely(check: ICheck, ctx: IScanContext): Promise<ICheckResult> {
  try {
    return await check.run(ctx)
  } catch (err) {
    return {
      id: check.id,
      category: check.category,
      status: EStatus.ERROR,
      score: 0,
      weight: 0, // zero weight so a crash can't move the score
      title: check.title,
      detail: `Check crashed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
