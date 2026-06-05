import { describe, expect, test } from 'bun:test'
import { isChatQuotaExceeded } from './route.ts'

describe('isChatQuotaExceeded', () => {
  test('blocks once usage reaches the limit', () => {
    expect(isChatQuotaExceeded(300, 300)).toBe(true)
    expect(isChatQuotaExceeded(301, 300)).toBe(true)
  })

  test('allows while under the limit', () => {
    expect(isChatQuotaExceeded(0, 300)).toBe(false)
    expect(isChatQuotaExceeded(299, 300)).toBe(false)
  })

  test('treats a zero (or negative) limit as no cap to enforce here', () => {
    // Free plans never reach this path; a 0 limit must not block as "exceeded".
    expect(isChatQuotaExceeded(0, 0)).toBe(false)
    expect(isChatQuotaExceeded(5, 0)).toBe(false)
  })
})
