import type { TUrl } from '../types.ts'

// MARK: - Constants

/**
 * RFC 1123 hostname with a real TLD: 1–63-char alnum/hyphen labels (no
 * leading/trailing hyphen), ≥2 labels, alpha or punycode (xn--) TLD.
 * IDN input is fine — `new URL()` converts it to punycode before this test.
 */
const HOSTNAME_RE =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/

// MARK: - Scan-input validation

export const EUrlProblem = {
  INVALID: 'invalid',
  PRIVATE: 'private',
} as const

export type TUrlProblem = (typeof EUrlProblem)[keyof typeof EUrlProblem]

export type TValidatedUrl = { ok: true; url: TUrl } | { ok: false; problem: TUrlProblem }

/**
 * Shared "can we scan this?" gate for the web form, API and CLI. Accepts a bare
 * host or a full URL, defaults the scheme to https, and rejects non-http(s),
 * localhost/`.local`/`.internal`, literal IPv4/bracketed-IPv6, and anything that
 * isn't a well-formed public hostname.
 *
 * @param {string} input - a user-entered host or URL (scheme optional).
 * @returns {TValidatedUrl} - `{ ok: true, url }` with the normalized URL, or
 *   `{ ok: false, problem }` where problem is 'invalid' (malformed/unsupported)
 *   or 'private' (localhost / IP / internal TLD).
 * @export
 */
export function validateScanInput(input: string): TValidatedUrl {
  const trimmed = input.trim()
  if (trimmed.length === 0 || /\s/.test(trimmed)) {
    return { ok: false, problem: EUrlProblem.INVALID }
  }

  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return { ok: false, problem: EUrlProblem.INVALID }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, problem: EUrlProblem.INVALID }
  }

  const host = parsed.hostname
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, problem: EUrlProblem.PRIVATE }
  }
  if (IPV4_RE.test(host) || host.startsWith('[')) {
    return { ok: false, problem: EUrlProblem.PRIVATE }
  }
  if (!HOSTNAME_RE.test(host)) {
    return { ok: false, problem: EUrlProblem.INVALID }
  }

  return { ok: true, url: parsed.toString() }
}

// MARK: - SSRF address guard

/**
 * Resolver injected by the caller (the server proxy passes a `node:dns` lookup).
 * Keeping DNS out of this module lets the scanner/CLI stay environment-agnostic.
 */
export type TDnsResolver = (host: string) => Promise<readonly string[]>

/**
 * True when `ip` (a literal IPv4 or IPv6 address) falls in a private, loopback,
 * link-local, CGNAT, ULA, multicast or otherwise reserved range. Unparseable
 * input is treated as unsafe (fail closed). Pure — safe everywhere.
 *
 * @param {string} ip - an IPv4 or IPv6 address literal (no brackets; an IPv6 zone id is stripped).
 * @returns {boolean} - true if the address is private/reserved OR unparseable; false only for a valid public address.
 * @export
 */
export function isPrivateAddress(ip: string): boolean {
  const trimmed = ip.trim()

  if (trimmed.includes(':')) {
    const bytes = ipv6ToBytes(trimmed)

    return bytes === null ? true : isPrivateIpv6(bytes)
  }

  const n = ipv4ToInt(trimmed)

  return n === null ? true : isPrivateIpv4(n)
}

/**
 * Resolve every host (initial URL + each redirect hop) and return the first that
 * maps to a private/reserved address — or `null` when all are public. A
 * resolution failure or empty answer fails closed (returns that host).
 *
 * @param {readonly string[]} hosts - the hostnames to check, in order (initial + redirect hops).
 * @param {TDnsResolver} resolve - resolves a host to its IP addresses.
 * @returns {Promise<string | null>} - the first host that is (or may be) private, else null.
 * @async
 * @export
 */
export async function firstPrivateHost(
  hosts: readonly string[],
  resolve: TDnsResolver,
): Promise<string | null> {
  for (const host of hosts) {
    let addresses: readonly string[]
    try {
      addresses = await resolve(host)
    } catch {
      return host
    }
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      return host
    }
  }

  return null
}

// MARK: - URL normalization

/**
 * Normalize user input ("example.com", "https://example.com/") to an origin URL.
 *
 * @param {string} input - a host or URL (scheme optional; defaults to https).
 * @returns {TUrl} - the parsed, normalized URL string.
 * @export
 */
export function normalizeUrl(input: string): TUrl {
  const trimmed = input.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(withScheme)

  return parsed.toString()
}

/**
 * The scheme + host origin of a URL (no path/query/hash).
 *
 * @param {TUrl} url - a valid absolute URL.
 * @returns {TUrl} - its origin (e.g. `https://example.com`).
 * @export
 */
export function originOf(url: TUrl): TUrl {
  return new URL(url).origin
}

/**
 * The host (hostname + optional port) of a URL.
 *
 * @param {TUrl} url - a valid absolute URL.
 * @returns {string} - its host.
 * @export
 */
export function hostOf(url: TUrl): string {
  return new URL(url).host
}

/**
 * The apex↔www counterpart of a host: `www.example.com` ↔ `example.com`.
 *
 * @param {string} host - a hostname.
 * @returns {string | null} - the counterpart, or null when neither form applies
 *   (e.g. a deeper subdomain that isn't `www.`).
 * @export
 */
export function counterpartHost(host: string): string | null {
  if (host.startsWith('www.')) {
    return host.slice(4)
  }

  const labels = host.split('.')
  if (labels.length === 2) {
    return `www.${host}`
  }

  return null
}

/**
 * Resolve a (possibly relative) reference against a base URL.
 *
 * @param {TUrl} base - the absolute base URL.
 * @param {string} ref - an absolute or relative reference.
 * @returns {TUrl} - the resolved absolute URL string.
 * @export
 */
export function resolveUrl(base: TUrl, ref: string): TUrl {
  return new URL(ref, base).toString()
}

// MARK: - internal (IPv4)

/**
 * Parse a dotted-quad IPv4 literal to its unsigned 32-bit integer.
 *
 * @param {string} ip - a candidate IPv4 literal.
 * @returns {number | null} - the integer value, or null when not a valid IPv4.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) {
    return null
  }

  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null
    }
    const value = Number(part)
    if (value > 255) {
      return null
    }
    n = n * 256 + value
  }

  return n >>> 0
}

/**
 * Whether an IPv4 integer is in any private/reserved CIDR block.
 *
 * @param {number} n - an unsigned 32-bit IPv4 integer.
 * @returns {boolean} - true if it falls in a private/reserved range.
 */
function isPrivateIpv4(n: number): boolean {
  const inRange = (base: string, bits: number): boolean => {
    const b = ipv4ToInt(base)
    if (b === null) {
      return false
    }
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (n & mask) === (b & mask)
  }

  return (
    inRange('0.0.0.0', 8) || // "this network"
    inRange('10.0.0.0', 8) || // private
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (incl. cloud metadata)
    inRange('172.16.0.0', 12) || // private
    inRange('192.0.0.0', 24) || // IETF protocol assignments
    inRange('192.0.2.0', 24) || // TEST-NET-1
    inRange('192.168.0.0', 16) || // private
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2
    inRange('203.0.113.0', 24) || // TEST-NET-3
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved + broadcast
  )
}

// MARK: - internal (IPv6)

/**
 * Expand an IPv6 literal (incl. `::` compression and a trailing embedded IPv4)
 * to its 16 bytes.
 *
 * @param {string} input - a candidate IPv6 literal (an optional zone id is dropped).
 * @returns {Uint8Array | null} - the 16 address bytes, or null when not a valid IPv6.
 */
function ipv6ToBytes(input: string): Uint8Array | null {
  let s = (input.split('%')[0] ?? input).toLowerCase() // drop any zone id
  if (!s.includes(':')) {
    return null
  }

  // Rewrite a trailing embedded IPv4 (e.g. ::ffff:1.2.3.4) into two hextets.
  const lastColon = s.lastIndexOf(':')
  const tail = s.slice(lastColon + 1)
  if (tail.includes('.')) {
    const n = ipv4ToInt(tail)
    if (n === null) {
      return null
    }
    const hi = ((n >>> 16) & 0xffff).toString(16)
    const lo = (n & 0xffff).toString(16)
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`
  }

  const halves = s.split('::')
  if (halves.length > 2) {
    return null
  }

  const head = hextetsToBytes(halves[0] ?? '')
  if (head === null) {
    return null
  }
  if (halves.length === 1) {
    return head.length === 16 ? Uint8Array.from(head) : null
  }

  const back = hextetsToBytes(halves[1] ?? '')
  if (back === null) {
    return null
  }
  const total = head.length + back.length
  if (total > 16) {
    return null
  }

  return Uint8Array.from([...head, ...Array.from<number>({ length: 16 - total }).fill(0), ...back])
}

/**
 * Convert a colon-separated run of IPv6 hextets to bytes.
 *
 * @param {string} segment - a hextet run (`''` → `[]`, for the empty side of `::`).
 * @returns {number[] | null} - the bytes, or null when a group is invalid.
 */
function hextetsToBytes(segment: string): number[] | null {
  if (segment === '') {
    return []
  }

  const out: number[] = []
  for (const group of segment.split(':')) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      return null
    }
    const value = parseInt(group, 16)
    out.push((value >> 8) & 0xff, value & 0xff)
  }

  return out
}

/**
 * Whether 16 IPv6 bytes are in a private/reserved range (ULA, link-local,
 * loopback, unspecified, multicast, or an embedded private IPv4-mapped address).
 *
 * @param {Uint8Array} b - the 16 address bytes.
 * @returns {boolean} - true if private/reserved.
 */
function isPrivateIpv6(b: Uint8Array): boolean {
  const at = (i: number): number => b[i] ?? 0

  // IPv4-mapped (::ffff:0:0/96): classify the embedded IPv4.
  const mapped = at(10) === 0xff && at(11) === 0xff && b.slice(0, 10).every((x) => x === 0)
  if (mapped) {
    return isPrivateIpv4(((at(12) << 24) | (at(13) << 16) | (at(14) << 8) | at(15)) >>> 0)
  }
  if (b.every((x) => x === 0)) {
    return true // unspecified ::
  }
  if (at(15) === 1 && b.slice(0, 15).every((x) => x === 0)) {
    return true // loopback ::1
  }
  if ((at(0) & 0xfe) === 0xfc) {
    return true // ULA fc00::/7
  }
  if (at(0) === 0xfe && (at(1) & 0xc0) === 0x80) {
    return true // link-local fe80::/10
  }
  if (at(0) === 0xff) {
    return true // multicast ff00::/8
  }

  return false
}
