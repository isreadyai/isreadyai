#!/usr/bin/env bun

/**
 * Dev cron ticker
 *
 * Vercel Cron fires GET /api/cron/scan-domains in production; locally nothing does, so monitored
 * sites never re-scan on schedule. This polls the endpointe very minute with the CRON_SECRET so
 * due monitoring_schedules actually run in dev. It only ever processes *due* schedules, so an
 * idle tick is a no-op.
 */
const PORT = process.env.PORT ?? '3300'
const SECRET = process.env.CRON_SECRET
const INTERVAL_MS = 60_000
// Dev serves HTTPS (--experimental-https): a non-HTTPS fetch EOFs on the TLS port.
const https = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://').startsWith('https')
const URL = `${https ? 'https' : 'http'}://127.0.0.1:${PORT}/api/cron/scan-domains`

if (SECRET === undefined || SECRET.length === 0) {
  console.log('[cron-dev] CRON_SECRET not set — skipping scheduled scans in dev.')
  process.exit(0)
}

async function tick(): Promise<void> {
  try {
    const response = await fetch(URL, {
      headers: { authorization: `Bearer ${SECRET}` },
      ...(https ? { tls: { rejectUnauthorized: false } } : {}),
    })
    const body = (await response.json().catch(() => ({}))) as { ran?: number }
    if (response.ok && (body.ran ?? 0) > 0) {
      console.log(`[cron-dev] ran ${body.ran} scheduled scan(s).`)
    }
  } catch {
    // The app may still be booting — try again next tick.
  }
}

console.log(`[cron-dev] polling ${URL} every ${INTERVAL_MS / 1000}s`)
await tick()
setInterval(() => void tick(), INTERVAL_MS)
