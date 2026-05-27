import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { describe, expect, it } from 'bun:test'
import { isPrivateAddress } from '../util/url.ts'
import { NativeProvider } from './native.ts'

// MARK: - Response body cap (memory safety)

/**
 * Untrusted scan targets can return arbitrarily large or never-ending bodies.
 * These tests prove the provider bounds memory: an oversized streamed body OR an
 * over-declared Content-Length fails closed with a body_too_large outcome, while
 * a body under the cap is returned intact. Servers bind to loopback; DNS is fixed
 * and 127.x is treated as public so the local server is reachable.
 */

interface ITestServer {
  port: number
  close: () => Promise<void>
}

function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<ITestServer> {
  const server = createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({ port, close: () => new Promise<void>((done) => server.close(() => done())) })
    })
  })
}

/** Provider with a fixed DNS (loopback treated as public) and an explicit body cap. */
function makeProvider(maxBodyBytes: number): NativeProvider {
  return new NativeProvider({
    resolve: async () => ['127.0.0.1'],
    isPrivate: (ip) => (ip.startsWith('127.') ? false : isPrivateAddress(ip)),
    maxBodyBytes,
  })
}

describe('NativeProvider body cap', () => {
  it('fails closed on a streamed body larger than the cap (no content-length)', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      // Chunked writes without a content-length: the streaming cap is what stops it.
      res.write('x'.repeat(40))
      res.write('y'.repeat(40))
      res.end('z'.repeat(40))
    })
    try {
      const result = await makeProvider(64).rawFetch(`http://site.test:${server.port}/`)
      expect(result.ok).toBe(false)
      expect(result.body).toBe('')
      expect(result.error ?? '').toMatch(/too large/i)
    } finally {
      await server.close()
    }
  })

  it('rejects an over-declared Content-Length before reading the body', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html', 'content-length': '10000000' })
      res.end('small')
    })
    try {
      const result = await makeProvider(1024).rawFetch(`http://site.test:${server.port}/`)
      expect(result.ok).toBe(false)
      expect(result.error ?? '').toMatch(/too large/i)
    } finally {
      await server.close()
    }
  })

  it('returns a body that fits under the cap', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html>ok</html>')
    })
    try {
      const result = await makeProvider(1024).rawFetch(`http://site.test:${server.port}/`)
      expect(result.ok).toBe(true)
      expect(result.body).toBe('<html>ok</html>')
    } finally {
      await server.close()
    }
  })
})
