import { z } from 'zod'
import { loadChatThread, type TChatScope } from '@/lib/chat-threads'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - Ask your site chat history
//
// Returns the signed-in user's saved thread for one scope (a website or a single
// scan), to preload useChat. Session-auth only (RLS owns the scoping in
// chat-threads). Always shaped as { messages } so the client can seed
// unconditionally.

const Uuid = z.string().uuid()

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const websiteId = params.get('websiteId')
  const scanId = params.get('scanId')
  // websiteId wins: a website thread is keyed by the website even though the
  // client also carries the scan it is currently viewing.
  let scope: TChatScope | null = null
  if (websiteId !== null && Uuid.safeParse(websiteId).success) {
    scope = { kind: 'website', websiteId }
  } else if (scanId !== null && Uuid.safeParse(scanId).success) {
    scope = { kind: 'report', scanId }
  }
  if (scope === null) {
    return Response.json({ messages: [] }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return Response.json({ messages: [] })
  }

  const messages = await loadChatThread(user.id, scope)
  return Response.json({ messages })
}
