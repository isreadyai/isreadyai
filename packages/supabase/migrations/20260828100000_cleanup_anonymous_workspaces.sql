-- delete_stale_anonymous_users() has failed since 20260629120000_security_update:
-- reaping an anonymous user cascades its owner membership away while its personal
-- workspace survives (workspaces.created_by is ON DELETE SET NULL), so the deferred
-- workspace_owner_guard rejects the now-ownerless workspace at commit. Remove the
-- workspaces that would be left without an active owner first; the guard skips a
-- workspace that no longer exists. Scans outlive the workspace (scans.workspace_id is
-- ON DELETE SET NULL). search_path is restated because CREATE OR REPLACE drops the
-- SET clause pinned by the earlier ALTER FUNCTION.

create or replace function public.delete_stale_anonymous_users(p_retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.workspaces w
  where exists (
      select 1
      from public.workspace_members m
      join auth.users u on u.id = m.user_id
      where m.workspace_id = w.id
        and m.role = 'owner'
        and m.status = 'active'
        and u.is_anonymous is true
        and u.created_at < now() - make_interval(days => p_retention_days)
    )
    and not exists (
      select 1
      from public.workspace_members m
      join auth.users u on u.id = m.user_id
      where m.workspace_id = w.id
        and m.role = 'owner'
        and m.status = 'active'
        and not (
          u.is_anonymous is true
          and u.created_at < now() - make_interval(days => p_retention_days)
        )
    );

  delete from auth.users
  where is_anonymous is true
    and created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_stale_anonymous_users(integer) from public, anon, authenticated;
grant execute on function public.delete_stale_anonymous_users(integer) to service_role;
