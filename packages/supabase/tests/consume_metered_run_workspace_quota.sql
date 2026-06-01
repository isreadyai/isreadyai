-- pgTAP: consume_metered_run's funded-AI quota (fix/plan/solve) is shared by
-- WORKSPACE, not by individual api_key. Regression for
-- 20260703120000_consume_metered_run_workspace_quota.sql: a Pro/Team
-- workspace minting multiple keys must not multiply its funded-run ceiling,
-- while a legacy (workspace-less) key keeps its own independent bucket.

create extension if not exists pgtap;

begin;
select plan(7);

-- Fixtures run as the test/superuser role (bypasses RLS).
insert into public.workspaces (id, name, slug)
values (
  '55555555-5555-5555-5555-555555555555',
  'Quota WS',
  'quota-ws-pgtap'
);

-- Two keys sharing one workspace.
insert into public.api_keys (id, key_hash, workspace_id)
values
  (
    '00000000-0000-0000-0000-0000000000e1',
    'pgtap-quota-key-a',
    '55555555-5555-5555-5555-555555555555'
  ),
  (
    '00000000-0000-0000-0000-0000000000e2',
    'pgtap-quota-key-b',
    '55555555-5555-5555-5555-555555555555'
  );

-- A legacy key, no workspace.
insert into public.api_keys (id, key_hash, workspace_id)
values ('00000000-0000-0000-0000-0000000000e3', 'pgtap-quota-key-legacy', null);

set local role service_role;

select isnt(
  public.consume_metered_run(
    '00000000-0000-0000-0000-0000000000e1', 'fix', 'o/r', 'https://x.test', 0, 60000, 2
  ),
  null,
  'key A reserves the workspace''s first funded run'
);

select isnt(
  public.consume_metered_run(
    '00000000-0000-0000-0000-0000000000e2', 'solve', 'o/r', 'https://x.test', 0, 60000, 2
  ),
  null,
  'key B (same workspace, limit 2) reserves the workspace''s second funded run'
);

select is(
  public.consume_metered_run(
    '00000000-0000-0000-0000-0000000000e1', 'plan', 'o/r', 'https://x.test', 0, 60000, 2
  ),
  null,
  'key A is blocked: the WORKSPACE (not the key) is already at its limit of 2'
);

select is(
  (
    select count(*) from public.fix_runs
    where workspace_id = '55555555-5555-5555-5555-555555555555'
  ),
  2::bigint,
  'exactly 2 fix_runs rows recorded for the shared workspace'
);

select isnt(
  public.consume_metered_run(
    '00000000-0000-0000-0000-0000000000e3', 'fix', 'o/r', 'https://x.test', 0, 60000, 1
  ),
  null,
  'legacy (workspace-less) key reserves against its own independent bucket'
);

select is(
  public.consume_metered_run(
    '00000000-0000-0000-0000-0000000000e3', 'solve', 'o/r', 'https://x.test', 0, 60000, 1
  ),
  null,
  'legacy key is blocked at its own limit of 1 (unaffected by the workspace bucket)'
);

select is(
  (
    select workspace_id from public.fix_runs
    where api_key_id = '00000000-0000-0000-0000-0000000000e3'
  ),
  null,
  'the legacy key''s recorded run keeps workspace_id NULL'
);

reset role;
select * from finish();
rollback;
