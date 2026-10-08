import { describe, expect, test } from 'bun:test'
import { challengeSignal } from './challenge.ts'

describe('challengeSignal', () => {
  test('returns the marker on a Cloudflare interstitial script', () => {
    expect(challengeSignal('<html><script>window._cf_chl_opt = {}</script></html>')).toBe(
      '_cf_chl_opt',
    )
  })

  test('returns the title fragment when the title is the challenge page', () => {
    expect(challengeSignal('<html><head><title>Just a moment...</title></head></html>')).toBe(
      'title: just a moment',
    )
  })

  test('returns null for a normal page that mentions "just a moment" in prose', () => {
    const html =
      '<html><head><title>Docs</title></head><body>Wait just a moment pages are common.</body></html>'
    expect(challengeSignal(html)).toBeNull()
  })
})
