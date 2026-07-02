-- Security hardening: lock the shared rate-limit functions to the service role,
-- guarantee every workspace keeps an active owner, and pin search_path on the
-- SECURITY DEFINER functions. Ordered so the search_path pin runs after the
-- owner-guard function it references is created.

-- These shared-counter functions are only ever called via the service role, but
-- the init migration left them EXECUTE-able by anon (PUBLIC gets EXECUTE by
-- default too) — letting anyone saturate a shared bucket and DoS the rate limits.

revoke all on function public.consume_rate_limit(text, bigint, integer)
  from public, anon, authenticated;

revoke all on function public.consume_metered_run(uuid, text, text, text, integer, bigint, integer)
  from public, anon, authenticated;

-- A workspace must always retain at least one active owner. The app checks this
-- before demote/remove/leave, but that check-then-write races under concurrency
-- (two owners removed at once can orphan the workspace). This deferred constraint
-- trigger is the atomic backstop: it evaluates at commit, so a single transaction
-- may still swap owners (transferOwnership) without tripping mid-way.

create function public.enforce_workspace_owner() returns trigger
    language plpgsql
    security definer
    as $$
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
$$;

create constraint trigger workspace_owner_guard
  after update or delete on public.workspace_members
  deferrable initially deferred
  for each row
  execute function public.enforce_workspace_owner();

-- Defense-in-depth: pin search_path on every SECURITY DEFINER function so a caller
-- can't prepend a malicious schema and hijack unqualified name resolution while the
-- function runs as its (privileged) owner. The bodies already fully-qualify public
-- objects; `= public` keeps any remaining unqualified refs resolving as before while
-- removing all caller influence over the path.

alter function public.consume_rate_limit(text, bigint, integer) set search_path = public;
alter function public.delete_stale_anonymous_users(integer) set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.is_active_workspace_member(uuid) set search_path = public;
alter function public.enforce_workspace_owner() set search_path = public;
