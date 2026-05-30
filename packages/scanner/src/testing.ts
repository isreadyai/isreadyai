import type { IFetchProvider, IRawResponse, IScanContext, TUrl } from './types.ts'

/**
 * Test fixtures: in-memory audit context for check testing without network access.
 * Enables fast, isolated unit tests with configurable responses and fetch mocks.
 */

// MARK: - Test harness

/**
 * Configuration for building a mock scan context from fixtures.
 *
 * Allows overriding request/response properties, mocking secondary fetches,
 * and custom response logic per URL+headers.
 *
 * @export
 * @typedef {IFixtureOptions}
 */
export type IFixtureOptions = Partial<
  Pick<IRawResponse, 'status' | 'headers' | 'body' | 'redirects' | 'tls' | 'error'>
> & {
  url?: TUrl
  ttfbMs?: number
  /** Absolute url -> response for ctx.fetchCached. */
  pages?: Record<TUrl, Partial<IRawResponse>>
  /** Custom responder for ctx.fetchWith (url + headers aware). */
  onFetchWith?: (url: TUrl, headers: Record<string, string>) => Partial<IRawResponse> | undefined
}

/**
 * Builds a complete raw response from a URL and partial properties.
 *
 * Fills missing properties with sensible defaults (200 OK, empty HTML, no TLS).
 *
 * @param {TUrl} url - The response URL.
 * @param {Partial<IRawResponse>} [partial] - Partial response properties to override defaults.
 * @returns {IRawResponse} - The complete raw response.
 * @export
 */
export function makeRaw(url: TUrl, partial: Partial<IRawResponse> = {}): IRawResponse {
  return {
    requestedUrl: url,
    finalUrl: partial.finalUrl ?? url,
    ok: (partial.status ?? 200) >= 200 && (partial.status ?? 200) < 300,
    status: partial.status ?? 200,
    headers: partial.headers ?? {},
    body: partial.body ?? '',
    redirects: partial.redirects ?? [],
    timing: partial.timing ?? { ttfbMs: 100, totalMs: 200 },
    tls: partial.tls ?? { valid: true },
    error: partial.error,
  }
}

/**
 * Builds a mock scan context from fixtures: isolated audit environment for check testing.
 *
 * Secondary fetches resolve from the `pages` map; cache misses return 404.
 *
 * @param {IFixtureOptions} [options] - Fixture configuration.
 * @returns {IScanContext} - The mock scan context.
 * @export
 */
export function makeContext(options: IFixtureOptions = {}): IScanContext {
  const url = options.url ?? 'https://example.com/'
  const raw = makeRaw(url, {
    status: options.status,
    headers: lowerKeys(options.headers ?? { 'content-type': 'text/html' }),
    body: options.body ?? '<html><head><title>Example</title></head><body>Hello</body></html>',
    redirects: options.redirects,
    timing: { ttfbMs: options.ttfbMs ?? 100, totalMs: (options.ttfbMs ?? 100) + 100 },
    tls: options.tls,
    error: options.error,
  })

  const pages = options.pages ?? {}

  return {
    url,
    raw,
    providers: [fixtureProvider(pages)],
    fetchCached(target: TUrl): Promise<IRawResponse> {
      const hit = pages[target]
      if (hit !== undefined) {
        return Promise.resolve(makeRaw(target, { ...hit, headers: lowerKeys(hit.headers ?? {}) }))
      }
      return Promise.resolve(makeRaw(target, { status: 404, body: 'Not found' }))
    },
    fetchWith(target: TUrl, requestHeaders: Record<string, string>): Promise<IRawResponse> {
      const custom = options.onFetchWith?.(target, requestHeaders)
      if (custom !== undefined) {
        return Promise.resolve(
          makeRaw(target, { ...custom, headers: lowerKeys(custom.headers ?? {}) }),
        )
      }
      const hit = pages[target]
      if (hit !== undefined) {
        return Promise.resolve(makeRaw(target, { ...hit, headers: lowerKeys(hit.headers ?? {}) }))
      }
      return Promise.resolve(makeRaw(target, raw))
    },
    log: () => undefined,
  }
}

// MARK: - internal

function fixtureProvider(pages: Record<TUrl, Partial<IRawResponse>>): IFetchProvider {
  return {
    name: 'fixture',
    rawFetch(target: TUrl): Promise<IRawResponse> {
      const hit = pages[target]
      return Promise.resolve(
        hit !== undefined
          ? makeRaw(target, { ...hit, headers: lowerKeys(hit.headers ?? {}) })
          : makeRaw(target, { status: 404, body: 'Not found' }),
      )
    },
  }
}

function lowerKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = v
  }
  return out
}
