// MARK: - DataFast server-side attribution helpers

export interface IDataFastSession {
  visitorId: string
  sessionId: string
}

const DATAFAST_VISITOR_COOKIE = 'datafast_visitor_id'
const DATAFAST_SESSION_COOKIE = 'datafast_session_id'

/**
 * Reads DataFast's attribution cookies for Stripe Checkout metadata. Best-effort:
 * missing cookies, blocked storage, or framework cookie-read failures simply
 * disable revenue attribution for that checkout attempt.
 */
export function dataFastSessionFromCookies(
  read: (name: string) => string | undefined,
): IDataFastSession | null {
  try {
    const visitorId = read(DATAFAST_VISITOR_COOKIE)?.trim() ?? ''
    const sessionId = read(DATAFAST_SESSION_COOKIE)?.trim() ?? ''
    if (visitorId === '' || sessionId === '') {
      return null
    }
    return { visitorId, sessionId }
  } catch {
    return null
  }
}
