-- pgTAP: a workspace must keep at least one active owner. Regression for
-- 20260629120000_security_update. The guard is a DEFERRED constraint
-- trigger, so the test forces it immediate to assert on each statement.

create extension if not exists pgtap;

begin;
select plan(3);

set constraints all immediate;

insert into auth.users (id, instance_id, email, aud, role)
values
  (
    '11111111-1111-1111-1111-1111111111d1',
    '00000000-0000-0000-0000-000000000000',
    'owner-a@test.local',
    'authenticated',
    'authenticated'
  ),
  (
    '11111111-1111-1111-1111-1111111111d2',
    '00000000-0000-0000-0000-000000000000',
    'owner-b@test.local',
    'authenticated',
    'authenticated'
  );

insert into public.workspaces (id, name, slug, created_by)
values (
  '33333333-3333-3333-3333-3333333333d1',
  'Owner Guard WS',
  'owner-guard-ws',
  '11111111-1111-1111-1111-1111111111d1'
);

insert into public.workspace_members (workspace_id, user_id, role, status)
values
  (
    '33333333-3333-3333-3333-3333333333d1',
    '11111111-1111-1111-1111-1111111111d1',
    'owner',
    'active'
  ),
  (
    '33333333-3333-3333-3333-3333333333d1',
    '11111111-1111-1111-1111-1111111111d2',
    'owner',
    'active'
  );

select lives_ok(
  $$delete from public.workspace_members
    where workspace_id = '33333333-3333-3333-3333-3333333333d1'
      and user_id = '11111111-1111-1111-1111-1111111111d2'$$,
  'can remove a non-last owner'
);

select throws_ok(
  $$delete from public.workspace_members
    where workspace_id = '33333333-3333-3333-3333-3333333333d1'
      and user_id = '11111111-1111-1111-1111-1111111111d1'$$,
  '23514',
  null,
  'cannot remove the last active owner'
);

select throws_ok(
  $$update public.workspace_members set role = 'member'
    where workspace_id = '33333333-3333-3333-3333-3333333333d1'
      and user_id = '11111111-1111-1111-1111-1111111111d1'$$,
  '23514',
  null,
  'cannot demote the last active owner'
);

select * from finish();
rollback;
