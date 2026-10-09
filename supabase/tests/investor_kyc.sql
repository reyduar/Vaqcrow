begin;

select plan(40);

-- Investor's simulated KYC (Feature #422, WU4).
--
-- `public.investor_kyc` is one row per investor. The API is the only writer and
-- connects as `service_role`: the simulated approval is auto-granted at the
-- first contribution (owner decision D2), so there is no client write path and
-- no client read path — `authenticated`/`anon` hold no grant at all.
--
-- RLS is enabled with zero policies (defense in depth on an exposed schema):
-- only `service_role`, which bypasses RLS, reaches the table, and the API scopes
-- every query by the verified principal's `user_id`. The primary key makes the
-- first-write path idempotent.
--
-- Reversal:
--   drop table if exists public.investor_kyc;

-- Structure -------------------------------------------------------------------

select has_table('public', 'investor_kyc', 'investor_kyc table exists');

select has_column('public', 'investor_kyc', 'user_id', 'investor_kyc has a user_id column');
select has_column('public', 'investor_kyc', 'approved_at', 'investor_kyc has an approved_at column');
select has_column('public', 'investor_kyc', 'simulado', 'investor_kyc has a simulado column');
select has_column('public', 'investor_kyc', 'created_at', 'investor_kyc has a created_at column');

select col_type_is('public', 'investor_kyc', 'user_id', 'uuid', 'user_id is a uuid');
select col_type_is('public', 'investor_kyc', 'approved_at', 'timestamp with time zone', 'approved_at is a timestamptz');
select col_type_is('public', 'investor_kyc', 'simulado', 'boolean', 'simulado is a boolean');
select col_type_is('public', 'investor_kyc', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');

select col_not_null('public', 'investor_kyc', 'user_id', 'a record always has an owner');
select col_not_null('public', 'investor_kyc', 'approved_at', 'a record always has an approval instant');
select col_not_null('public', 'investor_kyc', 'simulado', 'a record always declares whether it is simulated');
select col_not_null('public', 'investor_kyc', 'created_at', 'a record is always timestamped');

select col_has_default('public', 'investor_kyc', 'approved_at', 'approved_at defaults to now()');
select col_has_default('public', 'investor_kyc', 'simulado', 'simulado defaults to true (the demo is simulated)');
select col_has_default('public', 'investor_kyc', 'created_at', 'created_at defaults to now()');

select has_pk('public', 'investor_kyc', 'the user_id primary key exists');

select fk_ok(
  'public', 'investor_kyc', 'user_id',
  'public', 'profile', 'user_id',
  'investor_kyc.user_id references profile.user_id'
);

-- Access control: RLS on, zero policies, service_role only ----------------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.investor_kyc'::regclass),
  true,
  'investor_kyc has row-level security enabled'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'investor_kyc'),
  0,
  'investor_kyc has no policies: the API (service_role) is the only reader/writer'
);

select is(has_table_privilege('anon', 'public.investor_kyc', 'select'), false, 'anon cannot read investor_kyc');
select is(has_table_privilege('anon', 'public.investor_kyc', 'insert'), false, 'anon cannot insert investor_kyc');
select is(has_table_privilege('anon', 'public.investor_kyc', 'update'), false, 'anon cannot update investor_kyc');
select is(has_table_privilege('anon', 'public.investor_kyc', 'delete'), false, 'anon cannot delete investor_kyc');
select is(has_table_privilege('authenticated', 'public.investor_kyc', 'select'), false, 'authenticated cannot read investor_kyc');
select is(has_table_privilege('authenticated', 'public.investor_kyc', 'insert'), false, 'authenticated cannot insert investor_kyc');
select is(has_table_privilege('authenticated', 'public.investor_kyc', 'update'), false, 'authenticated cannot update investor_kyc');
select is(has_table_privilege('authenticated', 'public.investor_kyc', 'delete'), false, 'authenticated cannot delete investor_kyc');
select is(has_table_privilege('service_role', 'public.investor_kyc', 'select'), true, 'service role can read investor_kyc');
select is(has_table_privilege('service_role', 'public.investor_kyc', 'insert'), true, 'service role can insert investor_kyc');
select is(has_table_privilege('service_role', 'public.investor_kyc', 'update'), false, 'service role cannot update investor_kyc');
select is(has_table_privilege('service_role', 'public.investor_kyc', 'delete'), false, 'service role cannot delete investor_kyc');

-- Behavior: the defaults, the PK idempotency, the FK and the cascade -----------
-- Exercised as service_role, the role the API connects as, so the grants the
-- migration actually keeps are the ones under test.

-- A profile is created by the auth.users signup trigger, so the FK is exercised
-- against a real public.profile row.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'e1111111-1111-4111-8111-111111111111', 'investor-kyc@example.test',
  '{"role": "INVERSOR", "display_name": "Investor KYC"}'::jsonb, '{}'::jsonb
);

set local role service_role;

select lives_ok(
  $$
    insert into public.investor_kyc (user_id)
    values ('e1111111-1111-4111-8111-111111111111')
  $$,
  'service role records the simulated approval'
);

select is(
  (select approved_at is not null from public.investor_kyc where user_id = 'e1111111-1111-4111-8111-111111111111'),
  true,
  'approved_at defaults to now()'
);

select is(
  (select simulado from public.investor_kyc where user_id = 'e1111111-1111-4111-8111-111111111111'),
  true,
  'simulado defaults to true'
);

select is(
  (select created_at is not null from public.investor_kyc where user_id = 'e1111111-1111-4111-8111-111111111111'),
  true,
  'created_at defaults to now()'
);

select throws_ok(
  $$
    insert into public.investor_kyc (user_id)
    values ('e1111111-1111-4111-8111-111111111111')
  $$,
  '23505', null,
  'the same user_id cannot be inserted twice'
);

select is(
  (select count(*)::int from public.investor_kyc where user_id = 'e1111111-1111-4111-8111-111111111111'),
  1,
  'the duplicate did not add a second row'
);

select throws_ok(
  $$
    insert into public.investor_kyc (user_id)
    values ('e9999999-9999-4999-8999-999999999999')
  $$,
  '23503', null,
  'a record cannot point at a non-existent profile (owner FK)'
);

reset role;

delete from auth.users where id = 'e1111111-1111-4111-8111-111111111111';

set local role service_role;

select is(
  (select count(*)::int from public.investor_kyc where user_id = 'e1111111-1111-4111-8111-111111111111'),
  0,
  'deleting the profile cascades to its KYC record'
);

reset role;

select * from finish();

rollback;
