import { listChatThreads } from '@/lib/chat-threads'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// MARK: - Ask your site chat thread list
//
// All of the signed-in user's saved threads (website + report), newest first,
// for the in-panel history sidebar. Session-auth only; { threads: [] } for
// signed-out callers so the client can render unconditionally.

export async function GET(): Promise<Response> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return Response.json({ threads: [] })
  }

  const threads = await listChatThreads(user.id)
  return Response.json({ threads })
}
