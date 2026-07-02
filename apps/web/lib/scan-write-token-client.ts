// MARK: - Scan write token (browser storage)

const PREFIX = 'isr_wt_'

/** Persists the deep-scan write capability for `scanId` for this browser session. */
export function rememberScanWriteToken(scanId: string, token: string): void {
  try {
    sessionStorage.setItem(`${PREFIX}${scanId}`, token)
  } catch {
    // Private mode / storage off: deep-scan persistence is simply unavailable.
  }
}

/** Reads the capability the creating tab stored for `scanId`, or null. */
export function recallScanWriteToken(scanId: string): string | null {
  try {
    return sessionStorage.getItem(`${PREFIX}${scanId}`)
  } catch {
    return null
  }
}
