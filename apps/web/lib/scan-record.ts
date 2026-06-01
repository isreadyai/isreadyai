import type {
  IScanReport,
  ISiteReport,
  ISmartAgentReport,
  ISmartAgentSiteReport,
} from '@isreadyai/scanner'
import type { Tables } from '@isreadyai/supabase'

type TScanRow = Tables<'scans'>

export const EScanStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
} as const satisfies Record<string, TScanRow['status']>

type TDeclaredScanStatus = (typeof EScanStatus)[keyof typeof EScanStatus]
export type TScanStatus = Extract<TDeclaredScanStatus, TScanRow['status']>

export const ESmartScanStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
  // The domain owner turned the Smart Agent pass off — settled, not an error.
  DISABLED: 'disabled',
} as const satisfies Record<string, TScanRow['smart_status']>

type TDeclaredSmartScanStatus = (typeof ESmartScanStatus)[keyof typeof ESmartScanStatus]
export type TSmartScanStatus = Extract<TDeclaredSmartScanStatus, TScanRow['smart_status']>

const SCAN_STATUSES = new Set<TScanRow['status']>(Object.values(EScanStatus))
const SMART_SCAN_STATUSES = new Set<TScanRow['smart_status']>(Object.values(ESmartScanStatus))

export function isScanStatus(value: TScanRow['status']): value is TScanStatus {
  return SCAN_STATUSES.has(value)
}

export function isSmartScanStatus(value: TScanRow['smart_status']): value is TSmartScanStatus {
  return SMART_SCAN_STATUSES.has(value)
}

export interface IScanRecord extends Pick<TScanRow, 'id' | 'url' | 'error'> {
  status: TScanStatus
  report: IScanReport | null
  siteReport: ISiteReport | null
  smartStatus: TSmartScanStatus
  smartReport: ISmartAgentReport | null
  siteSmartReport: ISmartAgentSiteReport | null
  smartError: TScanRow['smart_error']
  createdAt: TScanRow['created_at']
}

export type TScanRecordPatch = Partial<
  Pick<
    IScanRecord,
    | 'status'
    | 'report'
    | 'siteReport'
    | 'error'
    | 'smartStatus'
    | 'smartReport'
    | 'siteSmartReport'
    | 'smartError'
  >
>

export type TScanRunPhase = 'idle' | 'running' | 'failed'

export function scanReportScore(report: TScanRow['report']): number | null {
  if (typeof report !== 'object' || report === null || Array.isArray(report)) {
    return null
  }
  return typeof report.overall === 'number' ? report.overall : null
}
