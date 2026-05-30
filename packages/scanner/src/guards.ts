import type { IScanReport, TGrade } from './types.ts'
import type { ISiteReport } from './crawl.ts'
import type { ISmartAgentReport, ISmartAgentSiteReport } from './smart-agent/types.ts'
import { EGrade } from './types.ts'

/**
 * Type guards for audit reports: runtime validation of report structure
 * to handle migration/version mismatches gracefully.
 */

const GRADES = new Set<string>(Object.values(EGrade))

/**
 * Narrows an unknown value to a canonical grade union.
 *
 * Useful for narrowing persisted `string | null` columns or untrusted inputs.
 *
 * @param {unknown} value - The value to test.
 * @returns {value is TGrade} - True if the value is a valid grade string.
 * @export
 */
export function isGrade(value: unknown): value is TGrade {
  return typeof value === 'string' && GRADES.has(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuditSummary(value: unknown): value is Record<string, unknown> {
  return (
    isObject(value) &&
    typeof value.url === 'string' &&
    typeof value.scoreVersion === 'string' &&
    typeof value.overall === 'number' &&
    typeof value.grade === 'string' &&
    GRADES.has(value.grade) &&
    Array.isArray(value.categories) &&
    typeof value.startedAt === 'string' &&
    typeof value.finishedAt === 'string'
  )
}

function isAuditReport(value: unknown): value is Record<string, unknown> {
  return isAuditSummary(value) && typeof value.finalUrl === 'string'
}

/**
 * Validates a scan report: the stable contract emitted by a single-page audit.
 *
 * @param {unknown} value - The value to test.
 * @returns {value is IScanReport} - True if the value is a valid scan report.
 * @export
 */
export function isScanReport(value: unknown): value is IScanReport {
  return (
    isAuditReport(value) &&
    Array.isArray(value.checks) &&
    isObject(value.meta) &&
    typeof value.meta.durationMs === 'number' &&
    typeof value.meta.fetchOk === 'boolean'
  )
}

/**
 * Validates a site report: the stable contract emitted by a deep crawl.
 *
 * NOTE: `clusters` is intentionally NOT validated — it was added post-launch
 * and requiring it would fail pre-cluster reports. Consumers must default it
 * (`site.clusters ?? []`) rather than assume presence.
 *
 * @param {unknown} value - The value to test.
 * @returns {value is ISiteReport} - True if the value is a valid site report.
 * @export
 */
export function isSiteReport(value: unknown): value is ISiteReport {
  return (
    isAuditSummary(value) &&
    typeof value.discovered === 'number' &&
    isScanReport(value.primary) &&
    Array.isArray(value.pages) &&
    value.pages.every(isScanReport)
  )
}

/**
 * Validates a Smart Agent report: the stable contract emitted by a rendered-page audit.
 *
 * @param {unknown} value - The value to test.
 * @returns {value is ISmartAgentReport} - True if the value is a valid Smart Agent report.
 * @export
 */
export function isSmartAgentReport(value: unknown): value is ISmartAgentReport {
  return (
    isAuditReport(value) &&
    Array.isArray(value.signals) &&
    isObject(value.agentView) &&
    typeof value.agentView.title === 'string' &&
    typeof value.agentView.snapshot === 'string' &&
    typeof value.agentView.interactiveSnapshot === 'string' &&
    Array.isArray(value.agentView.interactiveElements) &&
    isObject(value.meta) &&
    typeof value.meta.provider === 'string' &&
    typeof value.meta.durationMs === 'number'
  )
}

/**
 * Validates a Smart Agent site report: the stable contract for a site-wide rendered audit.
 *
 * @param {unknown} value - The value to test.
 * @returns {value is ISmartAgentSiteReport} - True if the value is a valid Smart Agent site report.
 * @export
 */
export function isSmartAgentSiteReport(value: unknown): value is ISmartAgentSiteReport {
  return (
    isAuditSummary(value) &&
    isSmartAgentReport(value.primary) &&
    Array.isArray(value.pages) &&
    value.pages.every(isSmartAgentReport) &&
    isObject(value.meta)
  )
}
