CREATE OR REPLACE FUNCTION public.delete_stale_anonymous_users (
  p_retention_days integer DEFAULT 30
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."delete_stale_anonymous_users"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_stale_anonymous_users"(integer) FROM PUBLIC, "anon", "authenticated";
