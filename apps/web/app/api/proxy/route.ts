import { lookup } from 'node:dns/promises'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  validateScanInput,
  firstPrivateHost,
  NativeProvider,
  type TDnsResolver,
} from '@isreadyai/scanner'
import { consumeRateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { SITE_URL } from '@/lib/site'
import { verifyProxyToken } from '@/lib/proxy-token'

// MARK: - POST /api/proxy

/**
 * Fetch relay for the client-side deep scan (CORS blocks the browser from
 * fetching third-party sites direct). Relays raw responses, no server-side
 * processing. Guards: same-site callers (Origin/Referer), per-IP rate limit,
 * string-level host validation, resolved-IP SSRF guard on the initial host and
 * every redirect hop, body cap, timeout.
 */

export const maxDuration = 30

const BODY_CAP = 1_500_000
// High ceiling: premium deep scans crawl thousands of pages; sized for a
// ~1000-3000 page uncapped crawl within a 60s sliding window.
const DEFAULT_RATE_LIMIT = 3000
const RATE_LIMIT =
  Number(process.env.PROXY_RATE_LIMIT) > 0
    ? Number(process.env.PROXY_RATE_LIMIT)
    : DEFAULT_RATE_LIMIT
const RATE_WINDOW_MS = 60_000
const BodySchema = z.object({
  url: z.string().min(3).max(2048),
})

const provider = new NativeProvider()

const SITE_ORIGIN = safeOrigin(SITE_URL)

/** A request is same-site when its Origin or Referer matches our origin. */
function isSameSite(value: string | null): boolean {
  if (value === null) {
    return false
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  // Exact host: a prefix check would admit `http://localhost.evil.tld`.
  return url.origin === SITE_ORIGIN || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

function safeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/** Matches the addresses fetch() would actually connect to (getaddrinfo). */
const resolveHost: TDnsResolver = async (host) => {
  const records = await lookup(host, { all: true, verbatim: true })
  return records.map((record) => record.address)
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  // Browser-only endpoint: require a same-site Origin/Referer. A caller with no
  // Origin (e.g. curl) must NOT pass — otherwise the relay is effectively public.
  if (!isSameSite(request.headers.get('origin')) && !isSameSite(request.headers.get('referer'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const ip = clientIp(request)
  if (!(await consumeRateLimit(ip, RATE_WINDOW_MS, RATE_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const validated = validateScanInput(parsed.data.url)
  if (!validated.ok) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  // Scan-scoped token: the server issues a host-bound HMAC when starting a deep
  // scan; every proxy call must present it. This prevents the relay from being
  // used for arbitrary hosts even if the Origin/Referer check were bypassed.
  const token = request.headers.get('x-proxy-token') ?? ''
  const requestedHost = new URL(validated.url).host
  if (!verifyProxyToken(token, requestedHost)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // SSRF guard before fetching: a public hostname whose DNS points at an
  // internal/metadata IP passes the string checks but must be rejected here.
  const initialHost = safeHostname(validated.url)
  if (initialHost === null || (await firstPrivateHost([initialHost], resolveHost)) !== null) {
    return NextResponse.json({ error: 'forbidden_target' }, { status: 403 })
  }

  const raw = await provider.rawFetch(validated.url)

  // Re-validate where redirects landed — a public host must stay public.
  const finalCheck = validateScanInput(raw.finalUrl)
  if (!finalCheck.ok) {
    return NextResponse.json({ error: 'invalid_redirect_target' }, { status: 400 })
  }

  // SSRF guard after the fact: re-resolve every redirect hop + the final URL so a
  // redirect into a private range can never return a body to the caller.
  const hopHosts = [
    raw.finalUrl,
    ...raw.redirects.flatMap((hop) => [hop.url, hop.location]),
  ].reduce<string[]>((acc, url) => {
    const host = safeHostname(url)
    if (host !== null && !acc.includes(host)) {
      acc.push(host)
    }
    return acc
  }, [])
  if ((await firstPrivateHost(hopHosts, resolveHost)) !== null) {
    return NextResponse.json({ error: 'forbidden_target' }, { status: 403 })
  }

  return NextResponse.json({ ...raw, body: raw.body.slice(0, BODY_CAP) })
}
