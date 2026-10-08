CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (id, email, terms_accepted_at)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz
  )
  on conflict (id) do nothing;

  insert into public.workspaces (name, slug, created_by, plan)
  values (
    coalesce(new.email, 'My workspace'),
    'u-' || replace(new.id::text, '-', ''),
    new.id,
    'free'
  )
  on conflict (slug) do nothing
  returning id into v_workspace_id;

  if v_workspace_id is null then
    select id into v_workspace_id
    from public.workspaces
    where slug = 'u-' || replace(new.id::text, '-', '');
  end if;

  if v_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
    values (v_workspace_id, new.id, 'owner', 'active', now())
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "anon", "authenticated", "service_role";
