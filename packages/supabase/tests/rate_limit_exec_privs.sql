-- pgTAP: the shared rate-limit / metered-run functions must not be executable by
-- anon or authenticated. Regression for 20260629120000_security_update:
-- the app calls them only through the service role, so a direct anon RPC call must
-- be denied — otherwise an attacker can saturate a shared bucket and DoS every
-- rate-limited endpoint.

create extension if not exists pgtap;

begin;
select plan(5);

-- The successful service-role path writes a fix_runs row, whose api_key_id is
-- protected by a foreign key. Keep the production constraint intact and give
-- the test a minimal parent row; the surrounding transaction rolls it back.
insert into public.api_keys (id, key_hash)
values (
  '00000000-0000-0000-0000-000000000000',
  'pgtap-rate-limit-exec-fixture'
);

set local role anon;

select throws_ok(
  $$select public.consume_rate_limit('test:pgtap', 60000, 100)$$,
  '42501',
  null,
  'anon CANNOT execute consume_rate_limit (permission denied)'
);

select throws_ok(
  $$select public.consume_metered_run('00000000-0000-0000-0000-000000000000', 'fix', 'o/r', 'https://x.test', 0, 60000, 1)$$,
  '42501',
  null,
  'anon CANNOT execute consume_metered_run (permission denied)'
);

reset role;
set local role authenticated;

select throws_ok(
  $$select public.consume_rate_limit('test:pgtap', 60000, 100)$$,
  '42501',
  null,
  'authenticated CANNOT execute consume_rate_limit (permission denied)'
);

reset role;
set local role service_role;

select ok(
  public.consume_rate_limit('test:pgtap', 60000, 100) is not null,
  'service_role CAN still execute consume_rate_limit (app path intact)'
);

select isnt(
  public.consume_metered_run('00000000-0000-0000-0000-000000000000', 'fix', 'o/r', 'https://x.test', 0, 60000, 1),
  null,
  'service_role CAN still execute consume_metered_run (app path intact)'
);

reset role;
select * from finish();
rollback;
