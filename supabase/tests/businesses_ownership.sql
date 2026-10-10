begin;

select plan(48);

-- PyME company model and per-row ownership (Feature #398, Task #399 / T3a,
-- owner decision 5 = option A). This unit is the database foundation only; the
-- API-side ownership scoping (R1-002) lands in T3b.
--
-- `public.businesses` is service_role-only: RLS is enabled and the grants are
-- set explicitly in the migration, with zero policies. `service_role` bypasses
-- RLS, so the API is the single enforcement point (the row's `owner_user_id`
-- must equal the caller). There is no client (anon/authenticated) path at all.
--
-- `public.sme_request` already existed as a service_role-only table
-- (select + insert, no update/delete); the migration only adds a nullable
-- `owner_user_id` column, so no grant change is needed and none is made.

-- Structure -------------------------------------------------------------------

select has_table('public', 'businesses', 'businesses table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.businesses'::regclass),
  true,
  'businesses has row-level security enabled'
);

select has_column('public', 'businesses', 'id', 'businesses has an id column');
select has_column('public', 'businesses', 'owner_user_id', 'businesses has an owner_user_id column');
select has_column('public', 'businesses', 'name', 'businesses has a name column');
select has_column('public', 'businesses', 'cuit', 'businesses has a cuit column');
select has_column('public', 'businesses', 'sector', 'businesses has a sector column');
select has_column('public', 'businesses', 'city', 'businesses has a city column');
select has_column('public', 'businesses', 'description', 'businesses has a description column');
select has_column('public', 'businesses', 'goal_ars', 'businesses has a goal_ars column');
select has_column('public', 'businesses', 'revenue_share', 'businesses has a revenue_share column');
select has_column(
  'public', 'businesses', 'campaign_duration_days',
  'businesses has a campaign_duration_days column (#410/U13)'
);
select col_type_is(
  'public', 'businesses', 'campaign_duration_days', 'smallint',
  'campaign_duration_days is a smallint'
);
select col_is_null(
  'public', 'businesses', 'campaign_duration_days',
  'campaign_duration_days is nullable for businesses registered before U13'
);
select has_column('public', 'businesses', 'created_at', 'businesses has a created_at column');
select has_column('public', 'businesses', 'updated_at', 'businesses has an updated_at column');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'businesses'),
  0,
  'businesses has no policies: the API (service_role) is the ownership enforcement point'
);

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.businesses', 'select'), false, 'anon cannot read businesses');
select is(has_table_privilege('anon', 'public.businesses', 'insert'), false, 'anon cannot insert businesses');
select is(has_table_privilege('anon', 'public.businesses', 'update'), false, 'anon cannot update businesses');
select is(has_table_privilege('authenticated', 'public.businesses', 'select'), false, 'authenticated cannot read businesses');
select is(has_table_privilege('authenticated', 'public.businesses', 'insert'), false, 'authenticated cannot insert businesses');
select is(has_table_privilege('authenticated', 'public.businesses', 'update'), false, 'authenticated cannot update businesses');
select is(has_table_privilege('service_role', 'public.businesses', 'select'), true, 'service role can read businesses');
select is(has_table_privilege('service_role', 'public.businesses', 'insert'), true, 'service role can insert businesses');
select is(has_table_privilege('service_role', 'public.businesses', 'update'), true, 'service role can update businesses');
select is(has_table_privilege('service_role', 'public.businesses', 'delete'), false, 'service role cannot delete businesses');

-- sme_request gains a nullable owner (pre-existing demo rows have none) --------

select has_column('public', 'sme_request', 'owner_user_id', 'sme_request now carries its owner');
select col_is_null(
  'public', 'sme_request', 'owner_user_id',
  'sme_request.owner_user_id is nullable for pre-existing demo rows'
);

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as, so the write grants
-- the migration actually keeps are the ones under test.

-- A profile is created by the auth.users signup trigger, so the FK is exercised
-- against a real public.profile row. The auth insert itself is the Auth
-- service's path, not the API role's (service_role cannot write auth.users).
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'e1111111-1111-4111-8111-111111111111', 'business-owner@example.test',
  '{"role": "PYME", "display_name": "Business Owner"}'::jsonb, '{}'::jsonb
);

set local role service_role;

-- The row is stamped in the past so the trigger's advance is observable within
-- one transaction: `now()` is the transaction timestamp, so `created_at` and a
-- freshly triggered `updated_at` would otherwise be identical.
insert into public.businesses (
  owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share,
  created_at, updated_at
) values (
  'e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20123456789',
  'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5,
  timestamptz '2000-01-01 00:00:00+00', timestamptz '2000-01-01 00:00:00+00'
);

select is(
  (select count(*)::int from public.businesses where name = 'Panadería Sol'),
  1,
  'a valid business is stored for its owner'
);

update public.businesses set name = 'Panadería Sol Renombrada' where cuit = '20123456789';

select is(
  (select updated_at > created_at from public.businesses where name = 'Panadería Sol Renombrada'),
  true,
  'an UPDATE advances updated_at'
);

-- The inclusive endpoints of the CHECK ranges are accepted, not only the
-- obviously valid interior values.
insert into public.businesses (
  owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
) values (
  'e1111111-1111-4111-8111-111111111111', 'Revenue Uno', '20123456700',
  'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 1
);

select is(
  (select count(*)::int from public.businesses where name = 'Revenue Uno'),
  1,
  'a revenue share of exactly 1 is accepted'
);

insert into public.businesses (
  owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
) values (
  'e1111111-1111-4111-8111-111111111111', 'Revenue Diez', '20123456701',
  'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 10
);

select is(
  (select count(*)::int from public.businesses where name = 'Revenue Diez'),
  1,
  'a revenue share of exactly 10 is accepted'
);

insert into public.businesses (
  owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
) values (
  'e1111111-1111-4111-8111-111111111111', 'Goal Uno', '20123456702',
  'Alimentos', 'CABA', 'Panadería artesanal de barrio', 1, 5
);

select is(
  (select count(*)::int from public.businesses where name = 'Goal Uno'),
  1,
  'a goal of exactly 1 is accepted'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
    ) values (
      'e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '12345',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5
    )$$,
  '23514', null,
  'a CUIT that is not exactly 11 digits is rejected'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
    ) values (
      'e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20123456780',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', 0, 5
    )$$,
  '23514', null,
  'a goal of zero is rejected'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
    ) values (
      'e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20123456780',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', -1, 5
    )$$,
  '23514', null,
  'a negative goal is rejected'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
    ) values (
      'e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20123456780',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 0
    )$$,
  '23514', null,
  'a revenue share below 1 is rejected'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
    ) values (
      'e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20123456780',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 11
    )$$,
  '23514', null,
  'a revenue share above 10 is rejected'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
    ) values (
      'e9999999-9999-4999-8999-999999999999', 'Panadería Sol', '20123456780',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5
    )$$,
  '23503', null,
  'a business cannot point at a non-existent profile (owner FK)'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
    ) values (
      null, 'Panadería Sol', '20123456780',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5
    )$$,
  '23502', null,
  'a business must have an owner'
);

-- Campaign duration (#410/U13): only 30, 60 or 90 days; NULL stays allowed
-- for businesses registered before the wizard captured it.
insert into public.businesses (
  owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share,
  campaign_duration_days
) values (
  'e1111111-1111-4111-8111-111111111111', 'Plazo Treinta', '20123456703',
  'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5, 30
), (
  'e1111111-1111-4111-8111-111111111111', 'Plazo Noventa', '20123456704',
  'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5, 90
);

select is(
  (select array_agg(campaign_duration_days order by campaign_duration_days)
     from public.businesses where name in ('Plazo Treinta', 'Plazo Noventa')),
  array[30, 90]::smallint[],
  'a campaign duration of 30 or 90 days is accepted'
);

select throws_ok(
  $$insert into public.businesses (
      owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share,
      campaign_duration_days
    ) values (
      'e1111111-1111-4111-8111-111111111111', 'Plazo Raro', '20123456705',
      'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5, 45
    )$$,
  '23514', null,
  'a campaign duration other than 30, 60 or 90 days is rejected'
);

select throws_ok(
  $$update public.businesses set campaign_duration_days = 0 where name = 'Plazo Treinta'$$,
  '23514', null,
  'an update cannot set a campaign duration outside 30, 60 or 90 days'
);

insert into public.application_review (application_id, state, last_correlation_id)
values ('a1111111-1111-4111-8111-111111111111', 'draft', 'c1111111-1111-4111-8111-111111111111');

insert into public.sme_request (
  application_id, sme_reference, declared_total_ars, period_start, period_end,
  correlation_id, owner_user_id
) values (
  'a1111111-1111-4111-8111-111111111111', 'sme:SYN-PH-0001', 100, '2026-01', '2026-08',
  'c2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111'
);

select is(
  (select owner_user_id::text from public.sme_request
    where application_id = 'a1111111-1111-4111-8111-111111111111'),
  'e1111111-1111-4111-8111-111111111111',
  'a new sme_request records its owner'
);

reset role;

-- Deleting the profile is the Auth service's deletion path: it cascades the
-- company (on delete cascade) and clears the request's owner (on delete set
-- null), keeping the request row. service_role has no DELETE on auth.users (or
-- profile), so the API role reads the resulting state below.
delete from auth.users where id = 'e1111111-1111-4111-8111-111111111111';

set local role service_role;

select is(
  (select count(*)::int from public.businesses
    where owner_user_id = 'e1111111-1111-4111-8111-111111111111'),
  0,
  'deleting the profile removes its business'
);

select is(
  (select owner_user_id from public.sme_request
    where application_id = 'a1111111-1111-4111-8111-111111111111'),
  null::uuid,
  'deleting the profile clears the request owner instead of deleting the request'
);

select is(
  (select count(*)::int from public.sme_request
    where application_id = 'a1111111-1111-4111-8111-111111111111'),
  1,
  'the request row survives its owner''s deletion'
);

reset role;

select * from finish();

rollback;
