/**
 * Native HTTP provider with SSRF protection.
 *
 * Node-only HTTP backend. Follows redirects manually so chains/loops are
 * observable, measures TTFB at header arrival, and treats a TLS handshake
 * failure as the TLS signal.
 *
 * SSRF hardening: every hop (the initial host AND each redirect target) is
 * DNS-resolved and checked against private/reserved ranges *before* the socket
 * is opened — a redirect into 169.254.169.254 / 10.x / ::1 is rejected without
 * ever firing the GET (no blind SSRF). The validated IPs are then pinned into
 * the connection via a custom `lookup`, so the address we checked is the address
 * we dial — closing the DNS-rebinding TOCTOU between resolve and connect.
 */

import type { IncomingMessage } from 'node:http'
import type { LookupFunction } from 'node:net'
import type {
  IFetchProvider,
  IRawResponse,
  IRedirectHop,
  ITlsInfo,
  TScanError,
  TUrl,
} from '../types.ts'
import { isPrivateAddress, resolveUrl } from '../util/url.ts'

// MARK: - Native provider

const MAX_REDIRECTS = 10
const FETCH_TIMEOUT_MS = 20_000
// Scanner targets are untrusted and may return arbitrarily large or unbounded
// bodies; cap reads to bound process memory. A hop exceeding this fails closed
// with a body_too_large outcome (overridable per provider for tests/strict callers).
const MAX_BODY_BYTES = 8 * 1024 * 1024

/**
 * Generic AI-fetcher user-agent string for crawler identification.
 *
 * @export
 */
export const SCANNER_UA = 'Mozilla/5.0 (compatible; IsReadyBot/1.0; +https://isready.ai/bot)'

/** Resolve a host to its candidate addresses (matches what `getaddrinfo` returns). */
export type TResolveHost = (host: string) => Promise<readonly string[]>

export interface INativeProviderOptions {
  /** DNS resolver; defaults to `node:dns` lookup. Injected by tests. */
  resolve?: TResolveHost
  /** Private/reserved-range predicate; defaults to `isPrivateAddress`. Injected by tests. */
  isPrivate?: (ip: string) => boolean
  /** Max response-body bytes before failing closed with body_too_large. Defaults to {@link MAX_BODY_BYTES}. */
  maxBodyBytes?: number
}

/**
 * HTTP fetcher with built-in SSRF protection and redirect tracking.
 *
 * @class NativeProvider
 * @typedef {NativeProvider}
 * @implements {IFetchProvider}
 * @export
 */
export class NativeProvider implements IFetchProvider {
  readonly name = 'native'
  private readonly resolve: TResolveHost
  private readonly isPrivate: (ip: string) => boolean
  private readonly maxBodyBytes: number

  /**
   * Initialize the native provider with optional DNS and IP validation overrides.
   *
   * @param {INativeProviderOptions} options - Configuration options for DNS resolution and private address checking.
   */
  constructor(options: INativeProviderOptions = {}) {
    this.resolve = options.resolve ?? defaultResolve
    this.isPrivate = options.isPrivate ?? isPrivateAddress
    this.maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES
  }

  /**
   * Fetch a URL, following redirects and tracking the chain.
   *
   * @param {TUrl} url - The URL to fetch.
   * @param {Record<string, string>} extraHeaders - Optional additional headers to include in the request.
   * @returns {Promise<IRawResponse>} The raw response including headers, body, redirects, and timing.
   * @async
   * @export
   */
  async rawFetch(url: TUrl, extraHeaders?: Record<string, string>): Promise<IRawResponse> {
    const first = await this.fetchChain(url, extraHeaders, false)
    if (first.error === undefined || !looksLikeTlsError(first.error)) {
      return first
    }
    // Invalid chain (e.g. missing intermediate): retry without verification to
    // still get the body, then pin tls.valid=false so trust.https flags it.
    const retried = await this.fetchChain(url, extraHeaders, true)
    if (retried.error !== undefined) {
      return first
    }
    return { ...retried, tls: { valid: false, error: first.error } }
  }

  // MARK: - internal

  private async fetchChain(
    url: TUrl,
    extraHeaders: Record<string, string> | undefined,
    insecure: boolean,
  ): Promise<IRawResponse> {
    const redirects: IRedirectHop[] = []
    const started = performance.now()
    let currentUrl = url
    let ttfbMs = 0

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const host = new URL(currentUrl).hostname

        // SSRF gate: resolve + validate before opening the socket. A failed or
        // empty resolution fails closed (we never connect blind).
        let addresses: readonly string[]
        try {
          addresses = await this.resolve(host)
        } catch {
          return this.errorResponse(
            url,
            currentUrl,
            redirects,
            started,
            `DNS lookup failed for ${host}`,
          )
        }
        if (addresses.length === 0) {
          return this.errorResponse(
            url,
            currentUrl,
            redirects,
            started,
            `DNS lookup failed for ${host}`,
          )
        }
        const blocked = addresses.find((ip) => this.isPrivate(ip))
        if (blocked !== undefined) {
          return this.errorResponse(
            url,
            currentUrl,
            redirects,
            started,
            `Blocked private address (${host} → ${blocked})`,
          )
        }

        const headers = {
          'user-agent': SCANNER_UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en',
          ...extraHeaders,
        }
        // Pin the validated IPs: the address we just checked is the address that
        // gets dialed, so a rebind between resolve and connect can't redirect us.
        const response = await sendRequest(currentUrl, {
          headers,
          insecure,
          lookup: pinnedLookup(addresses),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        // TTFB = first byte of the *final* response's headers.
        ttfbMs = performance.now() - started

        const status = response.statusCode ?? 0
        const location = headerValue(response.headers.location)
        if (status >= 300 && status < 400 && location !== null) {
          const next = resolveUrl(currentUrl, location)
          redirects.push({ url: currentUrl, status, location: next })
          response.resume() // Drain so the socket can be reused/closed.
          if (redirects.some((r, i) => i < redirects.length - 1 && r.url === next)) {
            return this.errorResponse(url, currentUrl, redirects, started, 'Redirect loop detected')
          }
          currentUrl = next
          continue
        }

        // Reject an oversized body up-front when the server declares one, then
        // enforce the same cap while streaming (a missing/lying length can't bypass it).
        const declared = Number(headerValue(response.headers['content-length']) ?? '')
        if (Number.isFinite(declared) && declared > this.maxBodyBytes) {
          response.destroy()
          return this.errorResponse(
            url,
            currentUrl,
            redirects,
            started,
            `Response body too large (${declared} bytes)`,
          )
        }
        const body = await readBody(response, this.maxBodyBytes)
        const totalMs = performance.now() - started

        return {
          requestedUrl: url,
          finalUrl: currentUrl,
          ok: status >= 200 && status < 300,
          status,
          headers: lowerCaseHeaders(response.headers),
          body,
          redirects,
          timing: { ttfbMs: Math.round(ttfbMs), totalMs: Math.round(totalMs) },
          tls: tlsFromSuccess(currentUrl),
        }
      }
      return this.errorResponse(
        url,
        currentUrl,
        redirects,
        started,
        `More than ${MAX_REDIRECTS} redirects`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = err instanceof Error && 'code' in err ? String(err.code) : ''
      const tls = looksLikeTlsError(`${code} ${message}`)
        ? ({ valid: false, error: message } satisfies ITlsInfo)
        : undefined
      return this.errorResponse(url, currentUrl, redirects, started, message, tls)
    }
  }

  private errorResponse(
    requestedUrl: TUrl,
    finalUrl: TUrl,
    redirects: IRedirectHop[],
    started: number,
    error: TScanError,
    tls?: ITlsInfo,
  ): IRawResponse {
    const totalMs = Math.round(performance.now() - started)
    return {
      requestedUrl,
      finalUrl,
      ok: false,
      status: 0,
      headers: {},
      body: '',
      redirects,
      timing: { ttfbMs: totalMs, totalMs },
      tls,
      error,
    }
  }
}

// MARK: - request helpers

// Lazy + bundler-ignored: this module is pulled into client graphs but only runs server-side.
interface INodeHttp {
  lookup: typeof import('node:dns/promises').lookup
  httpRequest: typeof import('node:http').request
  httpsRequest: typeof import('node:https').request
}
let cachedNodeHttp: INodeHttp | null = null
async function nodeHttp(): Promise<INodeHttp> {
  if (cachedNodeHttp !== null) {
    return cachedNodeHttp
  }
  const [dns, http, https] = await Promise.all([
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'node:dns/promises'),
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'node:http'),
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'node:https'),
  ])
  cachedNodeHttp = { lookup: dns.lookup, httpRequest: http.request, httpsRequest: https.request }
  return cachedNodeHttp
}

const defaultResolve: TResolveHost = async (host) => {
  const { lookup } = await nodeHttp()
  const records = await lookup(host, { all: true, verbatim: true })
  return records.map((record) => record.address)
}

interface ISendOptions {
  headers: Record<string, string>
  insecure: boolean
  lookup: LookupFunction
  signal: AbortSignal
}

/** Fire a GET and resolve once response headers arrive (body not yet read). */
async function sendRequest(url: TUrl, options: ISendOptions): Promise<IncomingMessage> {
  const { httpRequest, httpsRequest } = await nodeHttp()
  return new Promise((resolve, reject) => {
    const isHttps = new URL(url).protocol === 'https:'
    const send = isHttps ? httpsRequest : httpRequest
    const req = send(
      url,
      {
        method: 'GET',
        headers: options.headers,
        lookup: options.lookup,
        rejectUnauthorized: !options.insecure,
        signal: options.signal,
      },
      resolve,
    )
    req.on('error', reject)
    req.end()
  })
}

const familyOf = (ip: string): 4 | 6 => (ip.includes(':') ? 6 : 4)

/** Return a `lookup` that always hands back the pre-validated addresses. */
function pinnedLookup(addresses: readonly string[]): LookupFunction {
  return (_hostname, options, callback) => {
    if (typeof options === 'object' && options.all === true) {
      // Node dispatches on `options.all` at runtime and expects LookupAddress[].
      callback(
        null,
        addresses.map((address) => ({ address, family: familyOf(address) })),
      )
      return
    }
    const first = addresses[0] ?? '0.0.0.0'
    callback(null, first, familyOf(first))
  }
}

function readBody(response: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    response.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > maxBytes) {
        // Destroy the socket so an unbounded/never-ending body can't exhaust memory.
        response.destroy()
        reject(new Error(`Response body too large (>${maxBytes} bytes)`))
        return
      }
      chunks.push(chunk)
    })
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    response.on('error', reject)
  })
}

function headerValue(value: string | string[] | undefined): string | null {
  if (value === undefined) {
    return null
  }
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function lowerCaseHeaders(raw: IncomingMessage['headers']): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) {
      continue
    }
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value
  }
  return headers
}

function tlsFromSuccess(url: TUrl): ITlsInfo | undefined {
  if (!url.startsWith('https://')) {
    return undefined
  }
  // A completed https fetch implies the platform validated the chain.
  return { valid: true }
}

function looksLikeTlsError(message: string): boolean {
  return /certificate|cert|tls|ssl|handshake/i.test(message)
}
