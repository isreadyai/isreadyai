CREATE OR REPLACE FUNCTION public.consume_metered_run (
  p_api_key_id uuid,
  p_kind       text,
  p_repo       text,
  p_url        text,
  p_patches    integer,
  p_window_ms  bigint,
  p_limit      integer
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  v_workspace_id uuid;
  v_lock_key text;
  v_used integer;
  v_id uuid;
begin
  select workspace_id into v_workspace_id from public.api_keys where id = p_api_key_id;
  v_lock_key := case when v_workspace_id is not null then 'ws:' || v_workspace_id::text
                     else 'key:' || p_api_key_id::text end;
  perform pg_advisory_xact_lock(hashtext(v_lock_key));
  if v_workspace_id is not null then
    select count(*) into v_used from public.fix_runs
    where workspace_id = v_workspace_id
      and created_at >= now() - make_interval(secs => p_window_ms / 1000.0);
  else
    select count(*) into v_used from public.fix_runs
    where api_key_id = p_api_key_id
      and created_at >= now() - make_interval(secs => p_window_ms / 1000.0);
  end if;
  if v_used >= p_limit then return null; end if;
  insert into public.fix_runs (api_key_id, workspace_id, repo, url, patches, kind)
  values (p_api_key_id, v_workspace_id, p_repo, p_url, p_patches, p_kind)
  returning id into v_id;
  return v_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."consume_metered_run"(uuid, text, text, text, integer, bigint, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."consume_metered_run"(uuid, text, text, text, integer, bigint, integer) FROM PUBLIC, "anon", "authenticated";
