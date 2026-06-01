-- pgTAP: fix_runs_kind_check must accept all funded-AI run kinds the app
-- reserves. Regression for 20260703000000_fix_runs_kind_plan: the original
-- constraint only allowed ('fix', 'solve'), so POST /api/fix-plan reserving a
-- run via consumeMeteredRun(key, { kind: 'plan', ... }) (apps/web/lib/api-keys.ts)
-- hit the CHECK constraint on insert inside consume_metered_run, which made the
-- RPC return null and the route fail closed with 429 quota_exceeded on every
-- request, regardless of actual usage.

create extension if not exists pgtap;

begin;
select plan(5);

-- Fixtures run as the test/superuser role (bypasses RLS).
insert into public.api_keys (id, key_hash)
values (
  '00000000-0000-0000-0000-000000000001',
  'pgtap-fix-runs-kind-check-fixture'
);

select lives_ok(
  $$insert into public.fix_runs (api_key_id, repo, url, kind)
    values ('00000000-0000-0000-0000-000000000001', 'o/r', 'https://x.test', 'fix')$$,
  'fix_runs_kind_check still allows kind = fix'
);

select lives_ok(
  $$insert into public.fix_runs (api_key_id, repo, url, kind)
    values ('00000000-0000-0000-0000-000000000001', 'o/r', 'https://x.test', 'solve')$$,
  'fix_runs_kind_check still allows kind = solve'
);

select lives_ok(
  $$insert into public.fix_runs (api_key_id, repo, url, kind)
    values ('00000000-0000-0000-0000-000000000001', 'o/r', 'https://x.test', 'plan')$$,
  'fix_runs_kind_check now allows kind = plan (POST /api/fix-plan)'
);

select throws_ok(
  $$insert into public.fix_runs (api_key_id, repo, url, kind)
    values ('00000000-0000-0000-0000-000000000001', 'o/r', 'https://x.test', 'bogus')$$,
  '23514',
  null,
  'fix_runs_kind_check still rejects an unrecognised kind'
);

-- Exercises the exact path POST /api/fix-plan relies on: consume_metered_run
-- (called only via the service role — see 20260629120000_security_update and
-- packages/supabase/tests/rate_limit_exec_privs.sql) inserting a kind = 'plan'
-- row. Before the fix_runs_kind_check widening this returned null (CHECK
-- violation swallowed by the PL/pgSQL insert), which apps/web/lib/api-keys.ts
-- consumeMeteredRun() treats as fail-closed quota exhaustion.
set local role service_role;

select isnt(
  public.consume_metered_run(
    '00000000-0000-0000-0000-000000000001', 'plan', 'o/r', 'https://x.test', 0, 60000, 5
  ),
  null,
  'consume_metered_run reserves a kind = plan run (POST /api/fix-plan quota path)'
);

reset role;
select * from finish();
rollback;
