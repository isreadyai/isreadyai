-- pgTAP: function hardening from 20261008120000_harden_function_privileges.
-- search_path is pinned, trigger functions and the RLS helper are no longer
-- callable by anon/authenticated, service_role keeps the app RPCs, and the
-- triggers still fire.

create extension if not exists pgtap;

begin;
select plan(17);

select is(
  (select proconfig from pg_proc where oid = 'public.ai_usage_this_month(text, uuid, text)'::regprocedure),
  array['search_path=public'],
  'ai_usage_this_month pins search_path'
);

select is(
  (select proconfig from pg_proc where oid = 'public.consume_metered_run(uuid, text, text, text, integer, bigint, integer)'::regprocedure),
  array['search_path=public'],
  'consume_metered_run pins search_path'
);

select is(
  (select proconfig from pg_proc where oid = 'public.record_ai_usage(text, text, uuid, uuid, text, integer, bigint)'::regprocedure),
  array['search_path=public'],
  'record_ai_usage pins search_path'
);

select is(
  (select proconfig from pg_proc where oid = 'public.guard_profile_billing()'::regprocedure),
  array['search_path=public'],
  'guard_profile_billing pins search_path'
);

select ok(
  not has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  'anon cannot execute handle_new_user'
);
select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'authenticated cannot execute handle_new_user'
);
select ok(
  not has_function_privilege('anon', 'public.enforce_workspace_owner()', 'execute'),
  'anon cannot execute enforce_workspace_owner'
);
select ok(
  not has_function_privilege('authenticated', 'public.enforce_workspace_owner()', 'execute'),
  'authenticated cannot execute enforce_workspace_owner'
);
select ok(
  not has_function_privilege('anon', 'public.guard_profile_billing()', 'execute'),
  'anon cannot execute guard_profile_billing'
);
select ok(
  not has_function_privilege('authenticated', 'public.guard_profile_billing()', 'execute'),
  'authenticated cannot execute guard_profile_billing'
);

select ok(
  not has_function_privilege('anon', 'public.is_active_workspace_member(uuid)', 'execute'),
  'anon cannot execute is_active_workspace_member'
);
select ok(
  has_function_privilege('authenticated', 'public.is_active_workspace_member(uuid)', 'execute'),
  'authenticated can still execute is_active_workspace_member'
);

select ok(
  has_function_privilege('service_role', 'public.ai_usage_this_month(text, uuid, text)', 'execute'),
  'service_role can still execute ai_usage_this_month'
);
select ok(
  has_function_privilege('service_role', 'public.consume_metered_run(uuid, text, text, text, integer, bigint, integer)', 'execute'),
  'service_role can still execute consume_metered_run'
);
select ok(
  has_function_privilege('service_role', 'public.record_ai_usage(text, text, uuid, uuid, text, integer, bigint)', 'execute'),
  'service_role can still execute record_ai_usage'
);

insert into auth.users (id, instance_id, email, aud, role)
values (
  '11111111-1111-1111-1111-1111111111e1',
  '00000000-0000-0000-0000-000000000000',
  'fn-privs@test.local',
  'authenticated',
  'authenticated'
);

select is(
  (select email from public.profiles where id = '11111111-1111-1111-1111-1111111111e1'),
  'fn-privs@test.local',
  'handle_new_user trigger still creates the profile'
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '33333333-3333-3333-3333-3333333333e1',
  'Fn Privs WS',
  'fn-privs-ws',
  '11111111-1111-1111-1111-1111111111e1'
);

insert into public.workspace_members (workspace_id, user_id, role, status)
values (
  '33333333-3333-3333-3333-3333333333e1',
  '11111111-1111-1111-1111-1111111111e1',
  'owner',
  'active'
);

set constraints all immediate;

select throws_ok(
  $$delete from public.workspace_members
    where workspace_id = '33333333-3333-3333-3333-3333333333e1'
      and user_id = '11111111-1111-1111-1111-1111111111e1'$$,
  '23514',
  null,
  'workspace_owner_guard still blocks removing the last active owner'
);

select * from finish();
rollback;
