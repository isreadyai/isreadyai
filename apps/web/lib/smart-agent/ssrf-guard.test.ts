import { describe, expect, it } from 'bun:test'
import type { TDnsResolver } from '@isreadyai/scanner'
import { assertPublicUrl } from './ssrf-guard'

// MARK: - Smart Agent SSRF guard

/**
 * Proves the guard rejects any URL whose host resolves to (or literally is) a
 * private/reserved address, and fails closed on resolution failure — before a
 * real browser is ever pointed at it. The resolver is injected so these are
 * hermetic (no DNS / network).
 */
const resolverFor =
  (map: Record<string, readonly string[]>): TDnsResolver =>
  async (host) =>
    map[host] ?? []

describe('assertPublicUrl', () => {
  it('allows a host that resolves to a public address', async () => {
    await expect(
      assertPublicUrl(
        'https://example.com/page',
        resolverFor({ 'example.com': ['93.184.216.34'] }),
      ),
    ).resolves.toBeUndefined()
  })

  it('rejects a host that resolves to a private address (DNS-rebind shape)', async () => {
    await expect(
      assertPublicUrl('https://rebind.test/', resolverFor({ 'rebind.test': ['127.0.0.1'] })),
    ).rejects.toThrow(/private|rejected/i)
  })

  it('rejects a literal cloud-metadata IP', async () => {
    await expect(
      assertPublicUrl(
        'http://169.254.169.254/latest/meta-data/',
        resolverFor({ '169.254.169.254': ['169.254.169.254'] }),
      ),
    ).rejects.toThrow(/private|rejected/i)
  })

  it('fails closed when resolution returns nothing', async () => {
    await expect(assertPublicUrl('https://nodns.test/', resolverFor({}))).rejects.toThrow(
      /rejected/i,
    )
  })

  it('rejects an unparseable URL', async () => {
    await expect(assertPublicUrl('not a url', resolverFor({}))).rejects.toThrow(/invalid|rejected/i)
  })
})
