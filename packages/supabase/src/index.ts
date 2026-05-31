import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from './database.types.ts'

// MARK: - Typed Supabase client factory

/**
 * Server-only: the service client uses the secret key (sb_secret_*) and
 * bypasses RLS — it must never reach a client bundle. The supabase-js import
 * stays dynamic so apps running in zero-config mode (no Supabase env) never
 * load it at all.
 */

export type {
  CompositeTypes,
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types.ts'

export type TDbClient = SupabaseClient<Database>
export type TProfileRow = Tables<'profiles'>
export type TScanRow = Tables<'scans'>
export type TScanInsert = TablesInsert<'scans'>
export type TScanUpdate = TablesUpdate<'scans'>

// Workspaces / team (migration 20260615120000_workspaces_team.sql).
export type TWorkspaceRow = Tables<'workspaces'>
export type TWorkspaceInsert = TablesInsert<'workspaces'>
export type TWorkspaceUpdate = TablesUpdate<'workspaces'>
export type TWorkspaceMemberRow = Tables<'workspace_members'>
export type TWorkspaceInvitationRow = Tables<'workspace_invitations'>
export type TWebsiteRow = Tables<'websites'>
export type TWebsiteInsert = TablesInsert<'websites'>
export type TWebsiteUpdate = TablesUpdate<'websites'>
export type TMonitoringScheduleRow = Tables<'monitoring_schedules'>
export type TNotificationRow = Tables<'notifications'>
export type TNotificationInsert = TablesInsert<'notifications'>
export type TNotificationUpdate = TablesUpdate<'notifications'>
export type TNotificationPreferenceRow = Tables<'notification_preferences'>
export type TAuditEventRow = Tables<'audit_events'>

export function isSupabaseConfigured(): boolean {
  return (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.SUPABASE_SECRET_KEY === 'string' &&
    process.env.SUPABASE_SECRET_KEY.length > 0
  )
}

let serviceClient: Promise<TDbClient> | null = null

export function createServiceClient(): Promise<TDbClient> {
  serviceClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SECRET_KEY ?? '',
      { auth: { persistSession: false } },
    ),
  )
  return serviceClient
}
