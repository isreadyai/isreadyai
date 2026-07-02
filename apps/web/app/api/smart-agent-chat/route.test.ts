import { describe, expect, test } from 'bun:test'
import { isChatQuotaExceeded, resolveChatScope } from './route.ts'

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

describe('resolveChatScope', () => {
  const scanId = 'scan-1'

  test('honors a website scope only when grounding resolved (authorized member)', () => {
    expect(resolveChatScope(scanId, 'web-1', { scanId: 'ground-1', host: 'example.com' })).toEqual({
      scope: { kind: 'website', websiteId: 'web-1' },
      groundingScanId: 'ground-1',
    })
  })

  test('downgrades to report scope when an unauthorized websiteId fails to ground', () => {
    // Security boundary: resolveWebsiteGrounding returns null for a non-member, so
    // the unauthorized websiteId must NEVER reach the persisted scope.
    expect(resolveChatScope(scanId, 'web-1', null)).toEqual({
      scope: { kind: 'report', scanId },
      groundingScanId: scanId,
    })
  })

  test('stays report-scoped when no websiteId is requested', () => {
    expect(resolveChatScope(scanId, undefined, null)).toEqual({
      scope: { kind: 'report', scanId },
      groundingScanId: scanId,
    })
  })
})
