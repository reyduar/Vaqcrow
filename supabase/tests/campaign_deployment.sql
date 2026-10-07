begin;

select plan(27);

-- Campaign vault deployment lifecycle (Feature #410, Task #410 / T5b).
--
-- `public.campaign_deployment` is service_role-only: RLS is enabled and the
-- grants are set explicitly in the migration, with zero policies. `service_role`
-- bypasses RLS, so the API is the single writer; there is no client
-- (anon/authenticated) path at all. `last_error` stores an API-owned code, never
-- provider text, and `campaign_id` is a plain uuid by design (it must survive a
-- reconciled or cleaned-up mirror row).

-- Structure -------------------------------------------------------------------

select has_table('public', 'campaign_deployment', 'campaign_deployment table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign_deployment'::regclass),
  true,
  'campaign_deployment has row-level security enabled'
);

select has_column('public', 'campaign_deployment', 'application_id', 'has an application_id column');
select has_column('public', 'campaign_deployment', 'state', 'has a state column');
select has_column('public', 'campaign_deployment', 'attempts', 'has an attempts column');
select has_column('public', 'campaign_deployment', 'last_error', 'has a last_error column');
select has_column('public', 'campaign_deployment', 'campaign_id', 'has a campaign_id column');
select has_column('public', 'campaign_deployment', 'last_correlation_id', 'has a last_correlation_id column');
select has_column('public', 'campaign_deployment', 'created_at', 'has a created_at column');
select has_column('public', 'campaign_deployment', 'updated_at', 'has an updated_at column');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'campaign_deployment'),
  0,
  'campaign_deployment has no policies: the API (service_role) is the only writer'
);

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.campaign_deployment', 'select'), false, 'anon cannot read campaign_deployment');
select is(has_table_privilege('anon', 'public.campaign_deployment', 'insert'), false, 'anon cannot insert campaign_deployment');
select is(has_table_privilege('anon', 'public.campaign_deployment', 'update'), false, 'anon cannot update campaign_deployment');
select is(has_table_privilege('authenticated', 'public.campaign_deployment', 'select'), false, 'authenticated cannot read campaign_deployment');
select is(has_table_privilege('authenticated', 'public.campaign_deployment', 'insert'), false, 'authenticated cannot insert campaign_deployment');
select is(has_table_privilege('authenticated', 'public.campaign_deployment', 'update'), false, 'authenticated cannot update campaign_deployment');
select is(has_table_privilege('service_role', 'public.campaign_deployment', 'select'), true, 'service role can read campaign_deployment');
select is(has_table_privilege('service_role', 'public.campaign_deployment', 'insert'), true, 'service role can insert campaign_deployment');
select is(has_table_privilege('service_role', 'public.campaign_deployment', 'update'), true, 'service role can update campaign_deployment');
select is(has_table_privilege('service_role', 'public.campaign_deployment', 'delete'), false, 'service role cannot delete campaign_deployment');

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as, so the write grants
-- the migration actually keeps are the ones under test.

insert into public.application_review (application_id, state, last_correlation_id)
values ('a2222222-2222-4222-8222-222222222222', 'approved', 'c3333333-3333-4333-8333-333333333333');

set local role service_role;

-- The row is stamped in the past so the trigger's advance is observable within
-- one transaction: `now()` is the transaction timestamp, so `created_at` and a
-- freshly triggered `updated_at` would otherwise be identical.
insert into public.campaign_deployment (
  application_id, state, attempts, last_correlation_id, created_at, updated_at
) values (
  'a2222222-2222-4222-8222-222222222222', 'pending', 0, 'c3333333-3333-4333-8333-333333333333',
  timestamptz '2000-01-01 00:00:00+00', timestamptz '2000-01-01 00:00:00+00'
);

select is(
  (select state from public.campaign_deployment
    where application_id = 'a2222222-2222-4222-8222-222222222222'),
  'pending',
  'a deployment row is stored in pending'
);

update public.campaign_deployment
  set state = 'deploying', attempts = attempts + 1
  where application_id = 'a2222222-2222-4222-8222-222222222222';

select is(
  (select updated_at > created_at from public.campaign_deployment
    where application_id = 'a2222222-2222-4222-8222-222222222222'),
  true,
  'an UPDATE advances updated_at'
);

select throws_ok(
  $$update public.campaign_deployment set state = 'bogus'
    where application_id = 'a2222222-2222-4222-8222-222222222222'$$,
  '23514', null,
  'an unknown state is rejected'
);

select throws_ok(
  $$update public.campaign_deployment set attempts = -1
    where application_id = 'a2222222-2222-4222-8222-222222222222'$$,
  '23514', null,
  'a negative attempts count is rejected'
);

select throws_ok(
  $$insert into public.campaign_deployment (application_id, state, last_correlation_id)
    values ('a9999999-9999-4999-8999-999999999999', 'pending', 'c4444444-4444-4444-8444-444444444444')$$,
  '23503', null,
  'a deployment cannot point at a non-existent application'
);

select throws_ok(
  $$delete from public.application_review
    where application_id = 'a2222222-2222-4222-8222-222222222222'$$,
  '23503', null,
  'an application with a deployment cannot be deleted (on delete restrict)'
);

reset role;

select * from finish();

rollback;
