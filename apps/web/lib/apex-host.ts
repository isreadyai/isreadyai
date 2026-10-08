/** Hostname of the canonical site, without a scheme. */
export const APEX_HOST = 'isready.ai'

/** www counterpart that must 301 to the apex. */
export const WWW_HOST = 'www.isready.ai'

/** Apex URL for a www Host, or null. Path and query are kept. Scheme is https. */
export function wwwToApexUrl(hostHeader: string | null, current: URL): URL | null {
  if (hostnameOf(hostHeader) !== WWW_HOST) {
    return null
  }
  const target = new URL(current.href)
  target.protocol = 'https:'
  target.hostname = APEX_HOST
  target.port = ''
  return target
}

function hostnameOf(hostHeader: string | null): string {
  const raw = hostHeader?.split(',')[0]?.trim().toLowerCase() ?? ''
  const withoutPort = raw.replace(/:\d+$/, '')
  return withoutPort.endsWith('.') ? withoutPort.slice(0, -1) : withoutPort
}
