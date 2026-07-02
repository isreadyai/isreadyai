import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { isAuthorizedCron } from '@/lib/cron-auth'

// MARK: - GET /api/cron/cleanup-anonymous — reap stale anonymous users

/**
 * Anonymous sign-ins give every visitor an auth.users row, and Supabase never
 * auto-deletes them — unconverted anon accounts accumulate forever. This runs on
 * a schedule and deletes anon users older than the retention window via the
 * service-role-only delete_stale_anonymous_users() function. Protected by
 * CRON_SECRET (Vercel Cron sends it as a Bearer token when the env var is set).
 */

const RETENTION_DAYS = 30

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ deleted: 0, reason: 'no_persistence' })
  }

  const client = await createServiceClient()
  const { data, error } = await client.rpc('delete_stale_anonymous_users', {
    p_retention_days: RETENTION_DAYS,
  })
  if (error !== null) {
    return Response.json({ error: 'cleanup_failed' }, { status: 500 })
  }

  return Response.json({ deleted: data ?? 0 })
}
