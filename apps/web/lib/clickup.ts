// MARK: - ClickUp delivery (contact / feedback / fraud reports)
//
// Each submission does TWO things: it creates a ClickUp task (the durable record,
// in the contact list) AND posts a Markdown message into the isready.ai Chat
// channel for visibility — mirroring the SmartSquad lead flow. Markdown renders
// natively in both: the task via `markdown_content` (the plain-text `description`
// field does NOT render markdown), the chat message via `content_format: text/md`.
// Server-only: the token comes from a non-public env var.

const API_V2 = 'https://api.clickup.com/api/v2'
const API_V3 = 'https://api.clickup.com/api/v3'
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

/** Token + target list must be set for submissions to be recorded as tasks. */
export function isClickUpConfigured(): boolean {
  return (
    (process.env.CLICKUP_API_TOKEN ?? '') !== '' &&
    (process.env.CLICKUP_CONTACT_LIST_ID ?? '') !== ''
  )
}

/** Markdown body shared by the task description and the chat message. */
function buildMarkdown(input: IContactSubmission): string {
  return [
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
}

/** AbortSignal that fires after TIMEOUT_MS, plus a clear() to cancel the timer. */
function withTimeout(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

/**
 * Creates the ClickUp task for a submission (the durable record). Best-effort
 * with a 10s timeout; returns false on any failure so the route can surface a
 * clean error instead of throwing. Uses `markdown_content` so the body renders.
 */
export async function createContactTask(input: IContactSubmission): Promise<boolean> {
  const token = process.env.CLICKUP_API_TOKEN ?? ''
  const listId = process.env.CLICKUP_CONTACT_LIST_ID ?? ''
  if (token === '' || listId === '') {
    return false
  }

  const subject = input.host !== undefined && input.host !== '' ? input.host : input.email
  const name = `[${input.reason}] ${subject} — ${input.email}`
  const { signal, clear } = withTimeout()
  try {
    const response = await fetch(`${API_V2}/list/${listId}/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({ name, markdown_content: buildMarkdown(input) }),
      signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clear()
  }
}

/**
 * Posts the submission as a Markdown message to the isready.ai ClickUp Chat
 * channel. Additive and best-effort: returns false (without throwing) when the
 * channel isn't configured or the call fails, so it never blocks the recorded task.
 */
export async function postContactMessage(input: IContactSubmission): Promise<boolean> {
  const token = process.env.CLICKUP_API_TOKEN ?? ''
  const workspaceId = process.env.CLICKUP_WORKSPACE_ID ?? ''
  const channelId = process.env.CLICKUP_CONTACT_CHANNEL_ID ?? ''
  if (token === '' || workspaceId === '' || channelId === '') {
    return false
  }

  const { signal, clear } = withTimeout()
  try {
    const response = await fetch(
      `${API_V3}/workspaces/${workspaceId}/chat/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: token },
        body: JSON.stringify({
          type: 'message',
          content: buildMarkdown(input),
          content_format: 'text/md',
        }),
        signal,
      },
    )
    return response.ok
  } catch {
    return false
  } finally {
    clear()
  }
}
