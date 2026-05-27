import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { describe, expect, it } from 'bun:test'
import { isPrivateAddress } from '../util/url.ts'
import { NativeProvider, type INativeProviderOptions } from './native.ts'

// MARK: - SSRF guard (redirect hops + IP pinning)

/**
 * These tests prove the provider can never CONNECT to a private/link-local
 * address — on the initial host or any redirect hop — and that a blocked hop is
 * short-circuited before the GET is fired (blind-SSRF closed).
 *
 * All servers bind to loopback. The injected `isPrivate` predicate treats
 * 127.x as public (so the loopback test servers are reachable) while delegating
 * every other range to the real guard, so a redirect to 169.254.x is still
 * rejected for the right reason.
 */

interface ITestServer {
  port: number
  hits: () => number
  close: () => Promise<void>
}

function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<ITestServer> {
  let hits = 0
  const server = createServer((req, res) => {
    hits += 1
    handler(req, res)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({
        port,
        hits: () => hits,
        close: () => new Promise<void>((done) => server.close(() => done())),
      })
    })
  })
}

/** Provider whose DNS is a fixed host→IP map and that treats loopback as public. */
function makeProvider(map: Record<string, readonly string[]>): NativeProvider {
  const options: INativeProviderOptions = {
    resolve: async (host) => {
      const ips = map[host]
      if (ips === undefined) {
        throw new Error(`no DNS record for ${host}`)
      }
      return ips
    },
    isPrivate: (ip) => (ip.startsWith('127.') ? false : isPrivateAddress(ip)),
  }
  return new NativeProvider(options)
}

describe('NativeProvider SSRF guard', () => {
  it('rejects a redirect to a private/link-local IP without contacting it', async () => {
    const metadataUrl = 'http://169.254.169.254/latest/meta-data/'
    const origin = await startServer((_req, res) => {
      res.writeHead(302, { location: metadataUrl })
      res.end()
    })
    try {
      const provider = makeProvider({
        'origin.test': ['127.0.0.1'],
        // The metadata IP resolves to itself; the guard must block it before dialing.
        '169.254.169.254': ['169.254.169.254'],
      })

      const result = await provider.rawFetch(`http://origin.test:${origin.port}/start`)

      // Blocked at the pre-connect gate — not a timeout / connection error.
      expect(result.error).toContain('Blocked private address')
      expect(result.error).toContain('169.254.169.254')
      expect(result.status).toBe(0)
      // The redirect was observed, but only the origin was ever contacted.
      expect(result.redirects).toHaveLength(1)
      expect(result.redirects[0]?.location).toBe(metadataUrl)
      expect(origin.hits()).toBe(1)
    } finally {
      await origin.close()
    }
  })

  it('rejects a private initial host before any request', async () => {
    const provider = makeProvider({ 'metadata.test': ['169.254.169.254'] })

    const result = await provider.rawFetch('http://metadata.test/')

    expect(result.error).toContain('Blocked private address')
    expect(result.redirects).toHaveLength(0)
    expect(result.status).toBe(0)
  })

  it('follows a redirect to a public host and returns its body', async () => {
    const target = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('final-body')
    })
    let originPort = 0
    const origin = await startServer((_req, res) => {
      res.writeHead(301, { location: `http://target.test:${target.port}/page` })
      res.end()
    })
    originPort = origin.port
    try {
      const provider = makeProvider({
        'origin.test': ['127.0.0.1'],
        'target.test': ['127.0.0.1'],
      })

      const result = await provider.rawFetch(`http://origin.test:${originPort}/start`)

      expect(result.error).toBeUndefined()
      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.body).toBe('final-body')
      expect(result.finalUrl).toBe(`http://target.test:${target.port}/page`)
      expect(result.redirects).toHaveLength(1)
      expect(target.hits()).toBe(1)
    } finally {
      await origin.close()
      await target.close()
    }
  })

  it('caps the redirect chain length', async () => {
    let port = 0
    const chain = await startServer((req, res) => {
      const current = Number((req.url ?? '/r0').replace(/\D/g, '')) || 0
      res.writeHead(302, { location: `http://chain.test:${port}/r${current + 1}` })
      res.end()
    })
    port = chain.port
    try {
      const provider = makeProvider({ 'chain.test': ['127.0.0.1'] })

      const result = await provider.rawFetch(`http://chain.test:${port}/r0`)

      expect(result.error).toContain('More than')
      expect(result.error).toContain('redirects')
      // 10 hops max → 11 recorded redirects before the cap trips.
      expect(result.redirects).toHaveLength(11)
    } finally {
      await chain.close()
    }
  })
})
