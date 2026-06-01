-- pgTAP: the notifications SELECT policy must scope targeted rows to their user.
-- Regression for the P0 fix (20260621120000_notifications_targeted_select): a
-- member must NOT read another member's targeted notification, but must still see
-- workspace-wide rows (user_id null) and their own.

create extension if not exists pgtap;

begin;
select plan(4);

-- Fixtures run as the test/superuser role (bypasses RLS). Inserting into
-- auth.users fires on_auth_user_created, which materialises a profile.
insert into auth.users (id, instance_id, email, aud, role)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'owner-a@test.local',
    'authenticated',
    'authenticated'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'member-b@test.local',
    'authenticated',
    'authenticated'
  );

insert into public.workspaces (id, name, slug, created_by)
values (
  '33333333-3333-3333-3333-333333333333',
  'RLS Test WS',
  'rls-test-ws',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.workspace_members (workspace_id, user_id, role, status)
values
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'owner',
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'member',
    'active'
  );

insert into public.notifications (id, workspace_id, user_id, type, title)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'test',
    'targeted to A'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '33333333-3333-3333-3333-333333333333',
    null,
    'test',
    'workspace-wide'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'test',
    'targeted to B'
  );

-- Act as member B under RLS.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select ok(
  exists(select 1 from public.notifications where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'member sees a workspace-wide notification (user_id null)'
);

select ok(
  exists(select 1 from public.notifications where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'member sees their own targeted notification'
);

select ok(
  not exists(select 1 from public.notifications where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'member does NOT see another member''s targeted notification'
);

select is(
  (select count(*) from public.notifications),
  2::bigint,
  'member sees exactly the 2 visible rows, not all 3'
);

reset role;
select * from finish();
rollback;
