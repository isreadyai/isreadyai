import { describe, expect, test } from 'bun:test'
import { wwwToApexUrl } from './apex-host'

describe('wwwToApexUrl', () => {
  test('301 target keeps path and query and forces https', () => {
    const current = new URL('http://www.isready.ai/report/abc?mkt=1')
    const target = wwwToApexUrl('www.isready.ai', current)
    expect(target?.href).toBe('https://isready.ai/report/abc?mkt=1')
  })

  test('matches a port and a trailing dot', () => {
    const current = new URL('https://www.isready.ai/')
    expect(wwwToApexUrl('WWW.ISREADY.AI:443', current)?.host).toBe('isready.ai')
    expect(wwwToApexUrl('www.isready.ai.', current)?.host).toBe('isready.ai')
  })

  test('leaves the apex and other hosts alone', () => {
    const current = new URL('https://isready.ai/pricing')
    expect(wwwToApexUrl('isready.ai', current)).toBeNull()
    expect(wwwToApexUrl('localhost:3300', current)).toBeNull()
    expect(wwwToApexUrl(null, current)).toBeNull()
  })
})
