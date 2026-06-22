// MARK: - ClickUp task creation (contact / feedback / fraud reports)
//
// Mirrors the SmartSquad website's lead flow but carries everything in the task
// name + Markdown description (no custom-field-id coupling), so it works against
// any list. Server-only: the token comes from a non-public env var.

const API_URL = 'https://api.clickup.com/api/v2'
const TIMEOUT_MS = 10_000

export type TContactReason = 'feedback' | 'bug' | 'fraud' | 'other'

export interface IContactSubmission {
  reason: TContactReason
  email: string
  name?: string
  host?: string
  message: string
}

const REASON_LABEL: Record<TContactReason, string> = {
  feedback: 'Feedback',
  bug: 'Bug report',
  fraud: 'Domain ownership dispute',
  other: 'Contact',
}

/** Both the API token and the target list must be set for submissions to go through. */
export function isClickUpConfigured(): boolean {
  return (
    (process.env.CLICKUP_API_TOKEN ?? '') !== '' &&
    (process.env.CLICKUP_CONTACT_LIST_ID ?? '') !== ''
  )
}

/**
 * Creates a ClickUp task for a contact/feedback/fraud submission. Best-effort
 * with a 10s timeout; returns false on any failure so the route can surface a
 * clean error instead of throwing.
 */
export async function createContactTask(input: IContactSubmission): Promise<boolean> {
  const token = process.env.CLICKUP_API_TOKEN ?? ''
  const listId = process.env.CLICKUP_CONTACT_LIST_ID ?? ''
  if (token === '' || listId === '') {
    return false
  }

  const subject = input.host !== undefined && input.host !== '' ? input.host : input.email
  const name = `[${input.reason}] ${subject} — ${input.email}`
  const description = [
    `**Type:** ${REASON_LABEL[input.reason]}`,
    `**Email:** ${input.email}`,
    ...(input.name !== undefined && input.name !== '' ? [`**Name:** ${input.name}`] : []),
    ...(input.host !== undefined && input.host !== '' ? [`**Domain:** ${input.host}`] : []),
    '',
    '**Message:**',
    input.message,
    '',
    '_Sent from the isready.ai contact form._',
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${API_URL}/list/${listId}/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({ name, description }),
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
