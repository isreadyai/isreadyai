-- pgTAP: regression for 20260828100000_cleanup_anonymous_workspaces. Constraints
-- are forced immediate so the ownerless-workspace failure (or fix) is visible on
-- the reaping statement itself, matching how the RPC runs in a single transaction.

create extension if not exists pgtap;

begin;
select plan(5);

set constraints all immediate;

insert into auth.users (id, instance_id, email, is_anonymous, created_at, aud, role)
values
  (
    '22222222-2222-2222-2222-2222222222a1',
    '00000000-0000-0000-0000-000000000000',
    null,
    true,
    now() - interval '40 days',
    'authenticated',
    'authenticated'
  ),
  (
    '22222222-2222-2222-2222-2222222222a2',
    '00000000-0000-0000-0000-000000000000',
    null,
    true,
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    '22222222-2222-2222-2222-2222222222b1',
    '00000000-0000-0000-0000-000000000000',
    'regular@test.local',
    false,
    now() - interval '40 days',
    'authenticated',
    'authenticated'
  );

insert into public.scans (id, url, workspace_id, user_id)
values (
  '44444444-4444-4444-4444-444444444401',
  'https://example.com',
  (select id from public.workspaces where slug = 'u-' || replace('22222222-2222-2222-2222-2222222222a1', '-', '')),
  '22222222-2222-2222-2222-2222222222a1'
);

select is(
  public.delete_stale_anonymous_users(30),
  1,
  'reaps exactly the stale anonymous user'
);

select ok(
  not exists (select 1 from auth.users where id = '22222222-2222-2222-2222-2222222222a1'),
  'the stale anonymous user is gone'
);

select ok(
  not exists (
    select 1 from public.workspaces
    where slug = 'u-' || replace('22222222-2222-2222-2222-2222222222a1', '-', '')
  ),
  'its ownerless personal workspace is gone'
);

select is(
  (
    select count(*)::integer from auth.users
    where id in ('22222222-2222-2222-2222-2222222222a2', '22222222-2222-2222-2222-2222222222b1')
  ),
  2,
  'fresh anonymous and regular users survive'
);

select is(
  (select workspace_id from public.scans where id = '44444444-4444-4444-4444-444444444401'),
  null::uuid,
  'scans outlive the reaped workspace'
);

select * from finish();
rollback;
