import { describe, expect, test } from 'bun:test'
import { isScanAuthorized, parsePageUrls } from './route.ts'

describe('isScanAuthorized', () => {
  test('allows anonymous (public-by-id) scans', () => {
    expect(isScanAuthorized({ userId: null }, 'user-a')).toBe(true)
    expect(isScanAuthorized({ userId: null }, null)).toBe(true)
  })

  test('allows the owning caller', () => {
    expect(isScanAuthorized({ userId: 'user-a' }, 'user-a')).toBe(true)
  })

  test('rejects another account (IDOR)', () => {
    expect(isScanAuthorized({ userId: 'user-a' }, 'user-b')).toBe(false)
    expect(isScanAuthorized({ userId: 'user-a' }, null)).toBe(false)
  })

  test('rejects a missing scan', () => {
    expect(isScanAuthorized(null, 'user-a')).toBe(false)
  })
})

describe('parsePageUrls body cap', () => {
  const URL = 'https://isready.ai/api/scan/x/smart-deep'

  function jsonRequest(body: unknown): Request {
    return new Request(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  test('returns [] when no body is sent (API-key/CLI caller)', async () => {
    expect(await parsePageUrls(new Request(URL, { method: 'POST' }))).toEqual([])
  })

  test('keeps only non-empty string URLs', async () => {
    const req = jsonRequest({ pageUrls: ['https://a.com', '', 2, 'https://b.com', null] })
    expect(await parsePageUrls(req)).toEqual(['https://a.com', 'https://b.com'])
  })

  test('caps the URL list at 200 entries', async () => {
    const urls = Array.from({ length: 250 }, (_, i) => `https://a.com/${i}`)
    expect((await parsePageUrls(jsonRequest({ pageUrls: urls }))).length).toBe(200)
  })

  test('rejects an oversized body via the Content-Length header', async () => {
    const req = new Request(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '300000' },
      body: JSON.stringify({ pageUrls: [] }),
    })
    expect(parsePageUrls(req)).rejects.toThrow()
  })

  test('rejects an oversized streamed body with no Content-Length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(256_001))
        controller.close()
      },
    })
    const req = new Request(URL, {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    expect(parsePageUrls(req)).rejects.toThrow()
  })
})
