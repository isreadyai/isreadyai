import { firstPrivateHost, type TDnsResolver } from '@isreadyai/scanner'
import { lookup } from 'node:dns/promises'

// MARK: - SSRF guard for browser navigation

const defaultResolve: TDnsResolver = async (host) => {
  const records = await lookup(host, { all: true, verbatim: true })
  return records.map((record) => record.address)
}

/**
 * Resolves the URL's host and throws when it maps to a private/reserved address
 * (or resolution fails). The HTTP provider can pin the validated IP into its own
 * socket; an external headless browser cannot, so this closes the "host resolves
 * to an internal address" and literal-private-IP vectors before any real browser
 * is pointed at the URL.
 *
 * @remarks Residual: DNS rebinding between this check and the browser's own
 * connect needs browser-level request interception (tracked separately). The
 * `resolve` parameter is injectable for tests.
 *
 * @param url - the URL the Smart Agent is about to navigate to.
 * @param resolve - host→addresses resolver; defaults to node DNS lookup.
 */
export async function assertPublicUrl(
  url: string,
  resolve: TDnsResolver = defaultResolve,
): Promise<void> {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('Smart Agent navigation rejected: invalid URL')
  }
  const blocked = await firstPrivateHost([host], resolve)
  if (blocked !== null) {
    throw new Error(`Smart Agent navigation rejected: private or unresolvable host (${blocked})`)
  }
}
