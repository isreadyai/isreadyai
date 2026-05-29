/**
 * Smart Agent observation analysis types, signals, and report structures.
 */

import type {
  IAuditCategoryScore,
  IAuditReport,
  IAuditResult,
  IAuditSummary,
  TGrade,
  TJsonObject,
  TStatus,
  TUrl,
} from '../types.ts'
import { EGrade, EStatus } from '../types.ts'

// MARK: - Category & Status

/**
 * Smart Agent assessment categories aligned to AI crawler needs.
 *
 * @export
 */
export const ESmartAgentCategory = {
  VISIBLE_CONTENT: 'visible_content',
  UNDERSTANDABLE_STRUCTURE: 'understandable_structure',
  CONTENT_QUALITY: 'content_quality',
  ACCESSIBLE_CONTROLS: 'accessible_controls',
  NAVIGABILITY: 'navigability',
  BARRIERS: 'barriers',
} as const

/**
 * Union type of all Smart Agent categories.
 *
 * @export
 */
export type TSmartAgentCategory = (typeof ESmartAgentCategory)[keyof typeof ESmartAgentCategory]

/**
 * Human-readable labels for each Smart Agent category.
 *
 * @export
 */
export const SMART_AGENT_CATEGORY_LABELS: Record<TSmartAgentCategory, string> = {
  [ESmartAgentCategory.VISIBLE_CONTENT]: 'Visible content',
  [ESmartAgentCategory.UNDERSTANDABLE_STRUCTURE]: 'Understandable structure',
  [ESmartAgentCategory.CONTENT_QUALITY]: 'Content quality',
  [ESmartAgentCategory.ACCESSIBLE_CONTROLS]: 'Accessible controls',
  [ESmartAgentCategory.NAVIGABILITY]: 'Navigability',
  [ESmartAgentCategory.BARRIERS]: 'Agent barriers',
}

/**
 * Scoring weight for each Smart Agent category in overall calculation.
 *
 * @export
 */
export const SMART_AGENT_CATEGORY_WEIGHTS: Record<TSmartAgentCategory, number> = {
  [ESmartAgentCategory.VISIBLE_CONTENT]: 30,
  [ESmartAgentCategory.UNDERSTANDABLE_STRUCTURE]: 20,
  [ESmartAgentCategory.CONTENT_QUALITY]: 20,
  [ESmartAgentCategory.ACCESSIBLE_CONTROLS]: 15,
  [ESmartAgentCategory.NAVIGABILITY]: 10,
  [ESmartAgentCategory.BARRIERS]: 5,
}

// MARK: - Status

/**
 * Signal verdict status (pass, warn, fail).
 *
 * @export
 */
export const ESmartAgentStatus = {
  PASS: EStatus.PASS,
  WARN: EStatus.WARN,
  FAIL: EStatus.FAIL,
} as const

/**
 * Union type of all Smart Agent signal verdict statuses.
 *
 * @export
 */
export type TSmartAgentStatus = Extract<
  TStatus,
  (typeof ESmartAgentStatus)[keyof typeof ESmartAgentStatus]
>

/**
 * @deprecated Use EGrade. Kept as a compatibility alias.
 *
 * @export
 */
export const ESmartAgentGrade = EGrade

/**
 * @deprecated Use TGrade. Kept as a compatibility alias.
 *
 * @export
 */
export type TSmartAgentGrade = TGrade

// MARK: - Observation & Signals

/**
 * Reference to an interactive element or landmark in the page.
 *
 * @export
 * @interface ISmartAgentRef
 */
export interface ISmartAgentRef {
  role: string
  name: string
}

/**
 * Browser observation: snapshot, title, and element references from a single page render.
 *
 * @export
 * @interface ISmartAgentObservation
 */
export interface ISmartAgentObservation {
  requestedUrl: TUrl
  finalUrl: TUrl
  title: string
  snapshot: string
  interactiveSnapshot: string
  refs: Record<string, ISmartAgentRef>
}

/**
 * One assessment signal: a category-specific verdict and evidence.
 *
 * @export
 * @interface ISmartAgentSignal
 */
export interface ISmartAgentSignal extends IAuditResult<TSmartAgentCategory, TSmartAgentStatus> {
  evidence: TJsonObject
}

/**
 * Category score with per-category signals.
 *
 * @export
 * @interface ISmartAgentCategoryScore
 */
export interface ISmartAgentCategoryScore extends IAuditCategoryScore<TSmartAgentCategory> {
  signals: ISmartAgentSignal[]
}

/**
 * Browser view excerpt: title, snapshot, and interactive elements.
 *
 * @export
 * @interface ISmartAgentView
 */
export interface ISmartAgentView extends Pick<
  ISmartAgentObservation,
  'title' | 'snapshot' | 'interactiveSnapshot'
> {
  interactiveElements: ISmartAgentRef[]
}

// MARK: - Reports

/**
 * Complete Smart Agent assessment of a single page.
 *
 * @export
 * @interface ISmartAgentReport
 */
export interface ISmartAgentReport extends IAuditReport<ISmartAgentCategoryScore> {
  signals: ISmartAgentSignal[]
  agentView: ISmartAgentView
  meta: {
    provider: string
    durationMs: number
    agentBrowserVersion: string | null
  }
}

/**
 * Aggregated Smart Agent assessment across primary and sampled pages.
 *
 * @export
 * @interface ISmartAgentSiteReport
 */
export interface ISmartAgentSiteReport extends IAuditSummary<ISmartAgentCategoryScore> {
  /** Per-category aggregate across pages; `signals` empty — drill into pages. */
  primary: ISmartAgentReport
  pages: ISmartAgentReport[]
  meta: ISmartAgentReport['meta']
}

// MARK: - Command Execution

/**
 * Result of running a command (exit code and output streams).
 *
 * @export
 * @interface ICommandResult
 */
export interface ICommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Executor for Smart Agent commands (e.g. agent-browser).
 *
 * @export
 * @interface ISmartAgentCommandExecutor
 */
export interface ISmartAgentCommandExecutor {
  readonly name: string
  run(args: string[]): Promise<ICommandResult>
}
