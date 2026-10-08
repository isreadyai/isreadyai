CREATE OR REPLACE FUNCTION public.is_active_workspace_member (
  ws uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = (select auth.uid())
      and status = 'active'
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."is_active_workspace_member"(uuid) TO "anon", "authenticated", "service_role";
