-- pgTAP: secret hash columns must be unreadable by the `authenticated` role.
-- Regression for 20260621140000_hide_secret_columns: a workspace member can read
-- the non-secret columns of api_keys / workspace_invitations (RLS lets them see
-- the rows), but NOT key_hash / token_hash (column-privilege denied).

create extension if not exists pgtap;

begin;
select plan(7);

insert into auth.users (id, instance_id, email, aud, role)
values (
  '11111111-1111-1111-1111-1111111111c1',
  '00000000-0000-0000-0000-000000000000',
  'seccol-a@test.local',
  'authenticated',
  'authenticated'
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '33333333-3333-3333-3333-3333333333c1',
  'SecCol WS',
  'seccol-ws',
  '11111111-1111-1111-1111-1111111111c1'
);

insert into public.workspace_members (workspace_id, user_id, role, status)
values (
  '33333333-3333-3333-3333-3333333333c1',
  '11111111-1111-1111-1111-1111111111c1',
  'owner',
  'active'
);

insert into public.api_keys (id, key_hash, user_id, plan, workspace_id, created_by, prefix)
values (
  '44444444-4444-4444-4444-4444444444c1',
  'secret-hash-xyz',
  '11111111-1111-1111-1111-1111111111c1',
  'pro',
  '33333333-3333-3333-3333-3333333333c1',
  '11111111-1111-1111-1111-1111111111c1',
  'isr_ab'
);

insert into public.workspace_invitations (id, workspace_id, email, token_hash, expires_at, role, invited_by)
values (
  '55555555-5555-5555-5555-5555555555c1',
  '33333333-3333-3333-3333-3333333333c1',
  'invitee@test.local',
  'secret-token-hash',
  now() + interval '7 days',
  'member',
  '11111111-1111-1111-1111-1111111111c1'
);

-- Act as the active member under RLS.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-1111111111c1","role":"authenticated"}';

select ok(
  (
    select count(*) from public.api_keys
    where workspace_id = '33333333-3333-3333-3333-3333333333c1'
  ) >= 1,
  'member can read non-secret api_keys columns for their workspace'
);

select ok(
  (
    select count(*) from public.workspace_invitations
    where workspace_id = '33333333-3333-3333-3333-3333333333c1'
  ) >= 1,
  'member can read non-secret workspace_invitations columns for their workspace'
);

select throws_ok(
  'select key_hash from public.api_keys',
  '42501',
  null,
  'member CANNOT read api_keys.key_hash (column privilege denied)'
);

select throws_ok(
  'select token_hash from public.workspace_invitations',
  '42501',
  null,
  'member CANNOT read workspace_invitations.token_hash (column privilege denied)'
);

select throws_ok(
  'select * from public.api_keys',
  '42501',
  null,
  'select * is denied because it includes the hidden key_hash'
);

select ok(
  (
    select count(*) from public.workspaces
    where id = '33333333-3333-3333-3333-3333333333c1'
  ) >= 1,
  'member can read non-billing workspaces columns'
);

select throws_ok(
  'select stripe_customer_id from public.workspaces',
  '42501',
  null,
  'member CANNOT read workspaces.stripe_customer_id (billing identifier)'
);

reset role;
select * from finish();
rollback;
