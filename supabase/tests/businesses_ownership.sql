begin;

select plan(38);

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

-- A profile is created by the auth.users signup trigger, so the FK is exercised
-- against a real public.profile row.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'e1111111-1111-4111-8111-111111111111', 'business-owner@example.test',
  '{"role": "PYME", "display_name": "Business Owner"}'::jsonb, '{}'::jsonb
);

insert into public.businesses (
  owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share
) values (
  'e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20123456789',
  'Alimentos', 'CABA', 'Panadería artesanal de barrio', 5000000, 5
);

select is(
  (select count(*)::int from public.businesses
    where owner_user_id = 'e1111111-1111-4111-8111-111111111111'),
  1,
  'a valid business is stored for its owner'
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

-- Deleting the profile cascades the company (on delete cascade) and clears the
-- request's owner (on delete set null), keeping the request row.
delete from auth.users where id = 'e1111111-1111-4111-8111-111111111111';

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

select * from finish();

rollback;
