import type { Json } from './util/json.ts'

/**
 * Core audit types: URLs, timestamps, errors, and shared data structures for
 * scan reports, contexts, and check results across the engine.
 */

/** Minimal persisted-scan row the engine reads. Mirrors the `scans` table
 *  columns scanner depends on — intentionally not the full Supabase schema. */
interface TScanRow {
  url: string
  created_at: string
  error: string | null
}

/**
 * Canonical URL representation used by all persisted scans.
 *
 * @export
 * @typedef {TUrl}
 */
export type TUrl = TScanRow['url']

/**
 * Canonical timestamp representation used by all persisted scans (ISO 8601).
 *
 * @export
 * @typedef {TTimestamp}
 */
export type TTimestamp = TScanRow['created_at']

/**
 * Canonical non-null scan error string representation.
 *
 * @export
 * @typedef {TScanError}
 */
export type TScanError = NonNullable<TScanRow['error']>

/**
 * JSON object compatible with Supabase json/jsonb columns (object, not array).
 *
 * @export
 * @typedef {TJsonObject}
 */
export type TJsonObject = Exclude<Extract<Json, object>, Json[]>

// MARK: - Categories

/**
 * Audit check dimensions/categories: the independent aspects measured during a scan.
 *
 * Weights live on the registered checks, not on the categories themselves.
 *
 * @export
 * @typedef {ECategory}
 */
export const ECategory = {
  CRAWLER_ACCESS: 'crawler_access',
  RENDERING: 'rendering',
  STRUCTURED_DATA: 'structured_data',
  TRUST: 'trust',
  GEO_CONTENT: 'geo_content',
} as const

/**
 * Category union type: one of the canonical audit dimensions.
 *
 * @export
 * @typedef {TCategory}
 */
export type TCategory = (typeof ECategory)[keyof typeof ECategory]

/**
 * Human-facing labels for each audit category, for reports and UI.
 *
 * @export
 */
export const CATEGORY_LABELS: Record<TCategory, string> = {
  [ECategory.CRAWLER_ACCESS]: 'Crawler access',
  [ECategory.RENDERING]: 'Rendering',
  [ECategory.STRUCTURED_DATA]: 'Structured data',
  [ECategory.TRUST]: 'Trust & security',
  [ECategory.GEO_CONTENT]: 'Content (GEO)',
}

// MARK: - Status & severity

/**
 * Check result status: pass, warn, fail, or error when a check crashes.
 *
 * @export
 * @typedef {EStatus}
 */
export const EStatus = {
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail',
  INFO: 'info',
  ERROR: 'error',
} as const

/**
 * Status union type: one of the canonical check outcomes.
 *
 * @export
 * @typedef {TStatus}
 */
export type TStatus = (typeof EStatus)[keyof typeof EStatus]

/**
 * Severity/impact levels for issues: low, medium, or high.
 *
 * @export
 * @typedef {ELevel}
 */
export const ELevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

/**
 * Level union type: one of the canonical severity levels.
 *
 * @export
 * @typedef {TLevel}
 */
export type TLevel = (typeof ELevel)[keyof typeof ELevel]

// MARK: - Shared audit shapes

/**
 * One audit check result: status, score, and evidence for a category check.
 *
 * @export
 * @interface IAuditResult
 * @typedef {IAuditResult}
 * @template TAuditCategory
 * @template TResultStatus
 */
export interface IAuditResult<TAuditCategory, TResultStatus extends TStatus = TStatus> {
  id: string
  category: TAuditCategory
  status: TResultStatus
  /** Normalized 0..1 contribution to the parent category. */
  score: number
  weight: number
  title: string
  /** One-line plain-language outcome. */
  detail: string
  /** Concrete evidence (matched header, parsed value, counts…). */
  evidence?: TJsonObject
  /** What to do about it, when the result is not PASS. */
  fix?: string
}

/**
 * Aggregated score for one audit category: final score and metadata.
 *
 * @export
 * @interface IAuditCategoryScore
 * @typedef {IAuditCategoryScore}
 * @template TAuditCategory
 */
export interface IAuditCategoryScore<TAuditCategory> {
  category: TAuditCategory
  label: string
  score: number
  weight: number
}

/**
 * Audit summary: overall score, grade, and category breakdown (common to all audit types).
 *
 * @export
 * @interface IAuditSummary
 * @typedef {IAuditSummary}
 * @template TCategoryScore
 */
export interface IAuditSummary<TCategoryScore> extends Pick<TScanRow, 'url'> {
  scoreVersion: string
  /** Overall 0..100. */
  overall: number
  grade: TGrade
  categories: TCategoryScore[]
  startedAt: TTimestamp
  finishedAt: TTimestamp
}

/**
 * Audit report: audit summary + final URL (after redirects).
 *
 * @export
 * @interface IAuditReport
 * @typedef {IAuditReport}
 * @template TCategoryScore
 */
export interface IAuditReport<TCategoryScore> extends IAuditSummary<TCategoryScore> {
  finalUrl: TUrl
}

// MARK: - Fetch layer

/**
 * One HTTP redirect hop: status and Location header.
 *
 * @export
 * @interface IRedirectHop
 * @typedef {IRedirectHop}
 */
export interface IRedirectHop {
  url: TUrl
  status: number
  location: TUrl
}

/**
 * TLS certificate info: validity, protocol, and expiry.
 *
 * @export
 * @interface ITlsInfo
 * @typedef {ITlsInfo}
 */
export interface ITlsInfo {
  valid: boolean
  protocol?: string
  /** Days until the leaf certificate expires; negative means expired. */
  daysToExpiry?: number
  issuer?: string
  error?: TScanError
}

/**
 * Complete raw HTTP response: status, headers, body, redirects, timing, TLS, and errors.
 *
 * Represents exactly what a non-JavaScript AI crawler sees (no rendering).
 *
 * @export
 * @interface IRawResponse
 * @typedef {IRawResponse}
 */
export interface IRawResponse {
  requestedUrl: TUrl
  finalUrl: TUrl
  ok: boolean
  status: number
  headers: Record<string, string>
  body: string
  redirects: IRedirectHop[]
  timing: { ttfbMs: number; totalMs: number }
  tls?: ITlsInfo
  error?: TScanError
}

/**
 * HTTP fetch provider: pluggable fetch backend for audits (native, Playwright, etc.).
 *
 * Implementations fetch URLs exactly as non-JS AI crawlers do (no rendering).
 *
 * @export
 * @interface IFetchProvider
 * @typedef {IFetchProvider}
 */
export interface IFetchProvider {
  readonly name: string
  rawFetch(url: TUrl, headers?: Record<string, string>): Promise<IRawResponse>
}

// MARK: - Checks

/**
 * One check result: audit result + impact/effort metadata and docs link.
 *
 * @export
 * @interface ICheckResult
 * @typedef {ICheckResult}
 */
export interface ICheckResult extends IAuditResult<TCategory> {
  impact?: TLevel
  effort?: TLevel
  docsUrl?: TUrl
}

/**
 * Check scope: where a check runs.
 *
 * - site — one verdict per scan (robots, sitemap, TLS…): runs only on the primary URL
 * - page — one verdict per page (meta, schema, content…): runs on each page in a deep scan
 *
 * @export
 * @typedef {ECheckScope}
 */
export const ECheckScope = {
  SITE: 'site',
  PAGE: 'page',
} as const

/**
 * Check scope union type: site-scope or page-scope check.
 *
 * @export
 * @typedef {TCheckScope}
 */
export type TCheckScope = (typeof ECheckScope)[keyof typeof ECheckScope]

/**
 * One audit check definition: metadata + async run function.
 *
 * @export
 * @interface ICheck
 * @typedef {ICheck}
 */
export interface ICheck {
  id: string
  category: TCategory
  weight: number
  title: string
  scope: TCheckScope
  run(ctx: IScanContext): Promise<ICheckResult> | ICheckResult
}

/**
 * Scan configuration: checks to run, fetch providers, and optional progress callback.
 *
 * @export
 * @interface IScanOptions
 * @typedef {IScanOptions}
 */
export interface IScanOptions {
  providers?: IFetchProvider[]
  checks: ICheck[]
  onProgress?: (message: string) => void
}

// MARK: - Context

/**
 * Scan context: shared state passed to check run functions.
 *
 * Provides the primary fetch result, cached fetch methods, and logging.
 *
 * @export
 * @interface IScanContext
 * @typedef {IScanContext}
 */
export interface IScanContext extends Pick<TScanRow, 'url'> {
  raw: IRawResponse
  providers: IFetchProvider[]
  /** Cache of secondary fetches (robots.txt, sitemap…) keyed by absolute url. */
  fetchCached(url: TUrl): Promise<IRawResponse>
  /** Fetch with custom headers (AI user-agents, Accept negotiation). Cached per url+headers. */
  fetchWith(url: TUrl, headers: Record<string, string>): Promise<IRawResponse>
  log(message: string): void
}

// MARK: - Report

/**
 * Category score with checks that contributed to the score.
 *
 * @export
 * @interface ICategoryScore
 * @typedef {ICategoryScore}
 */
export interface ICategoryScore extends IAuditCategoryScore<TCategory> {
  checks: ICheckResult[]
}

/**
 * Audit grade letter: Excellent, Good, Moderate, or Poor.
 *
 * @export
 * @typedef {EGrade}
 */
export const EGrade = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  MODERATE: 'moderate',
  POOR: 'poor',
} as const

/**
 * Grade union type: one of the canonical grade letters.
 *
 * @export
 * @typedef {TGrade}
 */
export type TGrade = (typeof EGrade)[keyof typeof EGrade]

/**
 * Complete scan report: audit summary + all check results, metadata, and structural fingerprint.
 *
 * @export
 * @interface IScanReport
 * @typedef {IScanReport}
 */
export interface IScanReport extends IAuditReport<ICategoryScore> {
  checks: ICheckResult[]
  meta: {
    renderProvider: string | null
    durationMs: number
    fetchOk: boolean
    error?: TScanError
  }
  /** MinHash structural fingerprint (K=64) from structural-cluster.ts. Optional for
   *  backwards compatibility with persisted scans that pre-date this field. */
  fingerprint?: number[]
}
