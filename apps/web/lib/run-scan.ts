import type { IScanRecord } from './scan-record'

import { allChecks, scan } from '@isreadyai/scanner'
import { EScanStatus, ESmartScanStatus } from './scan-record'
import { getScanStore } from './scan-store'
import { runWebSmartAgentAudit } from './smart-agent/run-smart-agent'

// MARK: - Scan runner

/**
 * Runs one queued scan in the background (via next/server after()). Every
 * outcome — crashes included — is written back to the store.
 */

export async function runScan(
  id: IScanRecord['id'],
  opts: { smart?: boolean } = {},
): Promise<void> {
  const smart = opts.smart ?? true
  const store = await getScanStore()
  const record = await store.get(id)
  if (record === null || record.status !== EScanStatus.QUEUED) {
    return
  }

  await store.update(id, { status: EScanStatus.RUNNING })
  let finalUrl: string
  try {
    const report = await scan(record.url, { checks: allChecks })
    if (!report.meta.fetchOk) {
      await store.update(id, {
        status: EScanStatus.FAILED,
        report,
        error: report.meta.error ?? 'fetch failed',
        smartStatus: ESmartScanStatus.UNAVAILABLE,
        smartError: 'The base scan could not reach this site.',
      })
      return
    }
    await store.update(id, { status: EScanStatus.DONE, report })
    finalUrl = report.finalUrl
  } catch (err) {
    await store.update(id, {
      status: EScanStatus.FAILED,
      error: err instanceof Error ? err.message : String(err),
      smartStatus: ESmartScanStatus.UNAVAILABLE,
      smartError: 'The base scan did not complete.',
    })
    return
  }

  if (!smart) {
    await store.update(id, {
      smartStatus: ESmartScanStatus.DISABLED,
      smartReport: null,
      smartError: null,
    })
    return
  }

  await store.update(id, { smartStatus: ESmartScanStatus.RUNNING })
  try {
    const smartReport = await runWebSmartAgentAudit(finalUrl)
    await store.update(id, {
      smartStatus: ESmartScanStatus.DONE,
      smartReport,
      smartError: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const unavailable = isUnavailable(message)
    await store.update(id, {
      smartStatus: unavailable ? ESmartScanStatus.UNAVAILABLE : ESmartScanStatus.FAILED,
      smartError: unavailable ? 'agent_browser_unavailable' : 'agent_browser_failed',
    })
  }
}

function isUnavailable(message: string): boolean {
  return (
    message.includes('ENOENT') ||
    message.includes('AGENT_BROWSER') ||
    message.includes('authentication')
  )
}
