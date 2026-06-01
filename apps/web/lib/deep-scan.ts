'use client'

import type { IRawResponse, IScanReport, ISiteReport } from '@isreadyai/scanner'

// MARK: - Client-side deep scan

/**
 * The scanner engine runs in the browser; only raw fetches relay through
 * /api/proxy (CORS blocks the browser from fetching third-party sites direct).
 * The scanner import is lazy so it stays out of the initial bundle.
 */

const DEFAULT_LIMIT = 10

export function deepScanLimit(): number {
  const fromEnv = Number(process.env.NEXT_PUBLIC_DEEP_SCAN_LIMIT)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : DEFAULT_LIMIT
}

async function proxyFetch(url: string, proxyToken: string): Promise<IRawResponse> {
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-proxy-token': proxyToken },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) {
    // Shape an unreachable response instead of throwing: the engine treats it
    // as a dead page and the crawl continues.
    return {
      requestedUrl: url,
      finalUrl: url,
      ok: false,
      status: 0,
      headers: {},
      body: '',
      redirects: [],
      timing: { ttfbMs: 0, totalMs: 0 },
      tls: { valid: true },
      error: `proxy ${response.status}`,
    }
  }
  return (await response.json()) as IRawResponse
}

export async function runDeepScan(
  url: string,
  primary: IScanReport,
  onProgress: (message: string) => void,
  /** Page cap. Premium passes Infinity to crawl the whole site uncapped. */
  limit: number = deepScanLimit(),
  /** Host-bound HMAC token issued by the server; required by /api/proxy. */
  proxyToken = '',
): Promise<ISiteReport> {
  const { scanSite, allChecks } = await import('@isreadyai/scanner')
  return scanSite(url, {
    checks: allChecks,
    providers: [{ name: 'browser-proxy', rawFetch: (u) => proxyFetch(u, proxyToken) }],
    limit,
    // Reuse the server's primary scan instead of re-fetching the same page.
    primary,
    onProgress,
    // scanSite already runs a bounded worker pool (default 4). Raise to 8 so
    // large premium crawls stay comfortably under the proxy's 3000 req/60s
    // limit while still being reasonably polite to the target site.
    concurrency: 8,
  })
}
