import { describe, expect, test } from 'bun:test'
import { dataFastSessionFromCookies } from '@/lib/datafast-server'

// MARK: - DataFast server-side attribution cookies

describe('dataFastSessionFromCookies', () => {
  test('returns the visitor and session ids when both cookies exist', () => {
    const cookies = new Map([
      ['datafast_visitor_id', ' visitor-123 '],
      ['datafast_session_id', ' session-456 '],
    ])

    expect(dataFastSessionFromCookies((name) => cookies.get(name))).toEqual({
      visitorId: 'visitor-123',
      sessionId: 'session-456',
    })
  })

  test('returns null when either cookie is missing', () => {
    expect(dataFastSessionFromCookies(() => undefined)).toBeNull()
    expect(
      dataFastSessionFromCookies((name) =>
        name === 'datafast_visitor_id' ? 'visitor-123' : undefined,
      ),
    ).toBeNull()
  })

  test('returns null when reading cookies throws', () => {
    expect(
      dataFastSessionFromCookies(() => {
        throw new Error('blocked cookies')
      }),
    ).toBeNull()
  })
})
