import type { UIMessage } from 'ai'
import type { Json } from '@isreadyai/supabase'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'

// MARK: - Ask your site chat persistence
//
// Server-only (service role) wrapper over public.chat_threads. The full
// UIMessage[] thread is stored verbatim as JSON and loaded back into useChat. A
// thread is keyed by EITHER a website OR a single report/scan (website XOR
// report), per user: a website thread is one continuous conversation shared
// across all of a tracked website's scans; a report thread is a one-off scan.
// Reads fail soft (return []) so a storage hiccup never breaks the chat; the
// write is wrapped by the caller for the same reason.

const PREVIEW_MAX = 140

/** A chat thread is scoped to a website (the PRO case) or a single report/scan. */
export type TChatScope = { kind: 'website'; websiteId: string } | { kind: 'report'; scanId: string }

export interface ISaveChatThreadInput {
  userId: string
  host: string
  scope: TChatScope
  messages: UIMessage[]
}

export interface IChatThreadSummary {
  kind: TChatScope['kind']
  /** Set when kind === 'website'. */
  websiteId: string | null
  /** Set when kind === 'report'. */
  scanId: string | null
  host: string
  title: string
  preview: string
  messageCount: number
  lastMessageAt: string
}

/** Upsert the thread for a scope, replacing messages and bumping updated_at. */
export async function saveChatThread(input: ISaveChatThreadInput): Promise<void> {
  if (!isSupabaseConfigured()) {
    return
  }
  const service = await createServiceClient()
  // A website thread sets website_id (scan_id null); a report thread sets scan_id
  // (website_id null). The onConflict target is the matching partial-unique index.
  const row =
    input.scope.kind === 'website'
      ? { website_id: input.scope.websiteId, scan_id: null }
      : { website_id: null, scan_id: input.scope.scanId }
  const onConflict = input.scope.kind === 'website' ? 'user_id,website_id' : 'user_id,scan_id'
  const { error } = await service.from('chat_threads').upsert(
    {
      user_id: input.userId,
      host: input.host,
      ...row,
      messages: input.messages as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict },
  )
  if (error !== null) {
    throw new Error(`chat thread upsert failed: ${error.message}`)
  }
}

/** The stored thread for a scope, or [] when none exists or on any error. */
export async function loadChatThread(userId: string, scope: TChatScope): Promise<UIMessage[]> {
  if (!isSupabaseConfigured()) {
    return []
  }
  const service = await createServiceClient()
  const query = service.from('chat_threads').select('messages').eq('user_id', userId)
  const scoped =
    scope.kind === 'website'
      ? query.eq('website_id', scope.websiteId)
      : query.eq('scan_id', scope.scanId).is('website_id', null)
  const { data, error } = await scoped.maybeSingle()
  if (error !== null || data === null || !Array.isArray(data.messages)) {
    return []
  }
  return data.messages as unknown as UIMessage[]
}

/** All of a user's threads (website + report), newest first; [] on error. */
export async function listChatThreads(userId: string): Promise<IChatThreadSummary[]> {
  if (!isSupabaseConfigured()) {
    return []
  }
  const service = await createServiceClient()
  const { data, error } = await service
    .from('chat_threads')
    .select('website_id, scan_id, host, messages, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error !== null || data === null) {
    return []
  }
  return data
    .filter((row) => row.website_id !== null || row.scan_id !== null)
    .map((row) => {
      const messages = Array.isArray(row.messages) ? (row.messages as unknown as UIMessage[]) : []
      const isWebsite = row.website_id !== null
      return {
        kind: isWebsite ? ('website' as const) : ('report' as const),
        websiteId: row.website_id,
        scanId: isWebsite ? null : row.scan_id,
        host: row.host,
        // Website threads are the host itself; report threads disambiguate the
        // one-off by the day it was last touched.
        title: isWebsite ? row.host : `${row.host} · ${dateLabel(row.updated_at)}`,
        preview: previewOf(messages),
        messageCount: messages.length,
        lastMessageAt: row.updated_at,
      }
    })
}

/** Short, locale-stable day label for a report thread's title. */
function dateLabel(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Trimmed text of the last message, for the history list. */
function previewOf(messages: UIMessage[]): string {
  const last = messages.at(-1)
  if (last === undefined) {
    return ''
  }
  const text = last.parts
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim()
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX).trimEnd()}…` : text
}
