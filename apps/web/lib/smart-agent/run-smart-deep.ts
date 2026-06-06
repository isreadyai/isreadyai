import type { ISmartAgentReport, ISmartAgentSiteReport, ISiteReport } from '@isreadyai/scanner'
import type { ISmartAgentExecutorHandle } from './run-smart-agent'
import { aggregateSmartReports } from '@isreadyai/scanner'
import { createSmartAgentExecutor, runSmartAgentAuditWith } from './run-smart-agent'

// MARK: - Premium deep Smart Agent pass

const DEFAULT_PAGE_LIMIT = 20
const DEFAULT_CONCURRENCY = 4

/** How many pages (primary included) the premium deep smart pass will audit. */
export function smartDeepPageLimit(): number {
  const raw = Number(process.env.SMART_DEEP_PAGE_LIMIT)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_PAGE_LIMIT
}

/**
 * Pages rendered at once. Each render is its own browser session — the executor
 * drives a stateful open→snapshot→close sequence and can't multiplex one browser
 * across URLs — so this bounds concurrent Chromium / sandbox VMs. Kept small to
 * avoid OOM from many headless browsers.
 */
function smartDeepConcurrency(): number {
  const raw = Number(process.env.SMART_DEEP_CONCURRENCY)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_CONCURRENCY
}

/**
 * Runs the browser-capable audit on the primary plus up to (limit - 1) of the
 * deep-scanned pages, then aggregates (primary weighted double).
 */
export async function runWebSmartDeepAudit(site: ISiteReport): Promise<ISmartAgentSiteReport> {
  const extraPages = site.pages.slice(0, Math.max(0, smartDeepPageLimit() - 1))
  const targets = [site.primary, ...extraPages]
  return auditUrls(targets.map((target) => target.finalUrl))
}

/**
 * Same pass as runWebSmartDeepAudit but driven by a caller-supplied URL list:
 * the browser already crawled the site, so it sends the page URLs and the pass
 * no longer depends on a persisted siteReport. Caps to smartDeepPageLimit() (the
 * first URL is the primary, weighted double by aggregateSmartReports).
 * SECURITY: callers MUST pre-validate that every URL belongs to the scanned site
 * — this renders each URL in a real headless browser (the route does that check).
 */
export async function runWebSmartDeepAuditFromUrls(urls: string[]): Promise<ISmartAgentSiteReport> {
  return auditUrls(urls.slice(0, smartDeepPageLimit()))
}

type TOutcome<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Renders the URLs with a bounded worker pool (first URL = primary, weighted
 * double by aggregateSmartReports). Each worker owns ONE executor and reuses it
 * for every URL it pulls — so 20 pages at concurrency N create N executors, not
 * 20 (the big sandbox-create saving). Renders within a worker are sequential (the
 * executor's session is shared state); concurrency is across workers. Non-primary
 * pages that fail are dropped so one flaky page can't sink the pass; the primary
 * must succeed.
 */
async function auditUrls(urls: string[]): Promise<ISmartAgentSiteReport> {
  if (urls.length === 0) {
    throw new Error('Smart deep audit produced no reports')
  }
  const outcomes: TOutcome<ISmartAgentReport>[] = []
  let cursor = 0

  async function worker(): Promise<void> {
    let handle: ISmartAgentExecutorHandle
    try {
      handle = await createSmartAgentExecutor()
    } catch {
      // No executor → this worker renders nothing; peers drain the shared cursor.
      return
    }
    try {
      while (cursor < urls.length) {
        const index = cursor
        cursor += 1
        const url = urls[index]
        if (url === undefined) {
          continue
        }
        try {
          outcomes[index] = { ok: true, value: await runSmartAgentAuditWith(url, handle.executor) }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          outcomes[index] = { ok: false, error: message }
        }
      }
    } finally {
      // ALWAYS tear the executor down so no sandbox VM leaks; a teardown hiccup
      // must not discard the pages this worker already rendered.
      await handle.stop().catch(() => undefined)
    }
  }

  const size = Math.min(Math.max(1, smartDeepConcurrency()), urls.length)
  await Promise.all(Array.from({ length: size }, () => worker()))

  const primary = outcomes[0]
  if (primary === undefined || !primary.ok) {
    const detail = primary !== undefined && !primary.ok ? `: ${primary.error}` : ''
    throw new Error(`Smart deep audit could not render the primary page${detail}`)
  }
  const rest = outcomes.slice(1).flatMap((outcome) => (outcome.ok ? [outcome.value] : []))
  return aggregateSmartReports(primary.value, rest)
}
