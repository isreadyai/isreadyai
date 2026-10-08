CREATE OR REPLACE FUNCTION public.enforce_workspace_owner()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  -- Skip when the workspace itself is gone (a cascading delete removes its members).
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return null;
  end if;
  if
    old.role = 'owner'
    and old.status = 'active'
    and not exists (
      select 1
      from public.workspace_members
      where workspace_id = old.workspace_id and role = 'owner' and status = 'active'
    )
  then
    raise exception 'workspace % must keep at least one active owner', old.workspace_id
      using errcode = 'check_violation';
  end if;
  return null;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."enforce_workspace_owner"() FROM "anon", "authenticated", "service_role";
