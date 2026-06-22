// MARK: - GA4 server-side conversion events (Measurement Protocol)

const GA_ID = process.env.GA_MEASUREMENT_ID ?? ''
const MP_SECRET = process.env.GA_MP_API_SECRET ?? ''

export interface IGaSession {
  clientId: string
  sessionId: string | null
}

/**
 * Pulls the GA4 client_id + session_id out of the request cookies. Both only
 * exist once the visitor granted analytics consent (Consent Mode), so a null
 * result means "no consent / no GA session" and the caller simply skips the
 * event — keeping server-side tracking consent-aware. Cookie shapes (GS2 since
 * May 2025): `_ga = GA1.1.<client_id>.<ts>`, `_ga_<id> = GS2.1.s<session_id>$…`.
 */
export function gaSessionFromCookies(
  read: (name: string) => string | undefined,
): IGaSession | null {
  const ga = read('_ga')
  if (ga === undefined) {
    return null
  }
  const clientId = ga.split('.').slice(2).join('.')
  if (clientId === '') {
    return null
  }
  const session = read(`_ga_${GA_ID.replace('G-', '')}`)
  const sessionId =
    session
      ?.split('.')
      .slice(2)
      .join('.')
      .split('$')
      .find((part) => part.startsWith('s'))
      ?.slice(1) ?? null
  return { clientId, sessionId }
}

/**
 * Sends one GA4 event via the Measurement Protocol. `session_id` +
 * `engagement_time_msec` are required for the event to land in standard reports
 * (not only Realtime). Best-effort: no-ops when GA isn't configured or there's
 * no GA session, and never throws.
 */
export async function sendGaEvent(
  session: IGaSession | null,
  name: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  if (GA_ID === '' || MP_SECRET === '' || session === null || session.clientId === '') {
    return
  }
  const body = JSON.stringify({
    client_id: session.clientId,
    events: [
      {
        name,
        params: {
          ...(session.sessionId !== null ? { session_id: session.sessionId } : {}),
          engagement_time_msec: '100',
          ...params,
        },
      },
    ],
  })
  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${GA_ID}&api_secret=${MP_SECRET}`,
    { method: 'POST', body },
  ).catch(() => undefined)
}
