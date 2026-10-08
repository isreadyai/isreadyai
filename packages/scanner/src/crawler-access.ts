import type { IAiCrawler } from './crawlers.ts'
import type { ICheckResult } from './types.ts'
import { AI_CRAWLERS, ECrawlerPurpose } from './crawlers.ts'

/**
 * Per-crawler access table: joins each AI crawler's robots.txt rule with the
 * response the server gave when probed with that crawler's user-agent.
 */

// MARK: - Probe outcome

/**
 * What the server did when the homepage was requested as one AI crawler.
 *
 * @typedef {EProbeOutcome}
 * @export
 */
export const EProbeOutcome = {
  SERVED: 'served',
  REFUSED: 'refused',
  CHALLENGED: 'challenged',
  NO_RESPONSE: 'no-response',
} as const

/**
 * Probe outcome union type.
 *
 * @export
 * @typedef {TProbeOutcome}
 */
export type TProbeOutcome = (typeof EProbeOutcome)[keyof typeof EProbeOutcome]

/**
 * One server probe: the HTTP status and classified outcome for a crawler.
 *
 * @export
 * @interface ICrawlerProbe
 * @typedef {ICrawlerProbe}
 */
export interface ICrawlerProbe {
  /** robots.txt user-agent token of the probed crawler. */
  token: string
  /** HTTP status of the probe response (0 when there was no response). */
  status: number
  outcome: TProbeOutcome
}

// MARK: - Robots rule

/**
 * What robots.txt says to a crawler.
 *
 * @typedef {ERobotsRule}
 * @export
 */
export const ERobotsRule = {
  ALLOWED: 'allowed',
  BLOCKED: 'blocked',
  NO_ROBOTS: 'no-robots',
} as const

/**
 * Robots rule union type.
 *
 * @export
 * @typedef {TRobotsRule}
 */
export type TRobotsRule = (typeof ERobotsRule)[keyof typeof ERobotsRule]

// MARK: - Access row

/**
 * One row of the crawler access table.
 *
 * @export
 * @interface ICrawlerAccessRow
 * @typedef {ICrawlerAccessRow}
 * @extends {Pick<IAiCrawler, 'token' | 'operator' | 'purpose' | 'surface'>}
 */
export interface ICrawlerAccessRow extends Pick<
  IAiCrawler,
  'token' | 'operator' | 'purpose' | 'surface'
> {
  robots: TRobotsRule
  /** Null when this crawler was not probed (or the report predates probing). */
  probe: ICrawlerProbe | null
  /** robots.txt lets the crawler in (or there is no robots.txt) but the server refused or challenged it. */
  silentBlock: boolean
}

type TRobotsVerdict = Pick<IAiCrawler, 'token' | 'operator' | 'purpose' | 'surface'> & {
  blocked: boolean
}

const PURPOSES: readonly string[] = Object.values(ECrawlerPurpose)
const OUTCOMES: readonly string[] = Object.values(EProbeOutcome)

/**
 * Type guard for a crawler probe stored in check evidence.
 *
 * @param {unknown} value - Value to test.
 * @returns {boolean} - True when the value is a well-formed probe.
 * @export
 */
export function isCrawlerProbe(value: unknown): value is ICrawlerProbe {
  if (typeof value !== 'object' || value === null) return false
  const outcome = field(value, 'outcome')
  return (
    typeof field(value, 'token') === 'string' &&
    typeof field(value, 'status') === 'number' &&
    typeof outcome === 'string' &&
    OUTCOMES.includes(outcome)
  )
}

/**
 * Builds the crawler access table from a report's check results.
 *
 * @param {readonly ICheckResult[]} checks - The report's check results.
 * @returns {ICrawlerAccessRow[] | null} - Rows (probed crawlers first), or null when robots data is unavailable.
 * @export
 */
export function crawlerAccessRows(checks: readonly ICheckResult[]): ICrawlerAccessRow[] | null {
  const robotsEvidence = checks.find((c) => c.id === 'crawler.robots.ai-bots')?.evidence
  if (robotsEvidence === undefined) return null

  const noRobots = robotsEvidence['robotsPresent'] === false
  const rawVerdicts = robotsEvidence['crawlers']
  const verdicts = Array.isArray(rawVerdicts) ? rawVerdicts.filter(isRobotsVerdict) : []
  if (!noRobots && verdicts.length === 0) return null

  const rawProbes = checks.find((c) => c.id === 'crawler.ua-blocking')?.evidence?.['probes']
  const probes = new Map<string, ICrawlerProbe>()
  if (Array.isArray(rawProbes)) {
    for (const item of rawProbes) {
      if (isCrawlerProbe(item)) probes.set(item.token, item)
    }
  }

  const base: readonly TRobotsVerdict[] =
    verdicts.length > 0
      ? verdicts
      : AI_CRAWLERS.map((c) => ({
          token: c.token,
          operator: c.operator,
          purpose: c.purpose,
          surface: c.surface,
          blocked: false,
        }))

  const rows = base.map((v): ICrawlerAccessRow => {
    const robots = noRobots
      ? ERobotsRule.NO_ROBOTS
      : v.blocked
        ? ERobotsRule.BLOCKED
        : ERobotsRule.ALLOWED
    const probe = probes.get(v.token) ?? null
    return {
      token: v.token,
      operator: v.operator,
      purpose: v.purpose,
      surface: v.surface,
      robots,
      probe,
      silentBlock:
        robots !== ERobotsRule.BLOCKED && probe !== null && probe.outcome !== EProbeOutcome.SERVED,
    }
  })

  return [...rows.filter((r) => r.probe !== null), ...rows.filter((r) => r.probe === null)]
}

// MARK: - internal

function isRobotsVerdict(value: unknown): value is TRobotsVerdict {
  if (typeof value !== 'object' || value === null) return false
  const purpose = field(value, 'purpose')
  return (
    typeof field(value, 'token') === 'string' &&
    typeof field(value, 'operator') === 'string' &&
    typeof field(value, 'surface') === 'string' &&
    typeof field(value, 'blocked') === 'boolean' &&
    typeof purpose === 'string' &&
    PURPOSES.includes(purpose)
  )
}

function field(value: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(value, key)?.value
}
