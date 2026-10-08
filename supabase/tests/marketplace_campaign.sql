begin;

select plan(39);

-- Public marketplace campaign read model (Feature #414, WU1).
--
-- `public.marketplace_campaign` is the server-side join of a published campaign
-- (a confirmed vault deployment on an `open` campaign) to its company and its
-- AI assessment. It is service_role-only: RLS on the base tables stays the
-- enforcement point, `security_invoker = true` keeps the view from bypassing it,
-- and there is no client (anon/authenticated) path at all.

-- Structure -------------------------------------------------------------------

select has_view('public', 'marketplace_campaign', 'marketplace_campaign view exists');

select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.marketplace_campaign'::regclass),
  true,
  'marketplace_campaign runs with security_invoker (honors base-table privileges)'
);

select has_column('public', 'marketplace_campaign', 'campaign_id', 'has a campaign_id column');
select has_column('public', 'marketplace_campaign', 'name', 'has a name column');
select has_column('public', 'marketplace_campaign', 'sector', 'has a sector column');
select has_column('public', 'marketplace_campaign', 'city', 'has a city column');
select has_column('public', 'marketplace_campaign', 'goal_ars', 'has a goal_ars column');
select has_column('public', 'marketplace_campaign', 'revenue_share', 'has a revenue_share column');
select has_column('public', 'marketplace_campaign', 'total_stroops', 'has a total_stroops column');
select has_column('public', 'marketplace_campaign', 'goal_stroops', 'has a goal_stroops column');
select has_column('public', 'marketplace_campaign', 'deadline', 'has a deadline column');
select has_column('public', 'marketplace_campaign', 'risk_band', 'has a risk_band column');
select has_column('public', 'marketplace_campaign', 'risk_confidence', 'has a risk_confidence column');
select has_column('public', 'marketplace_campaign', 'fx_rate_version', 'has an fx_rate_version column');
select has_column('public', 'marketplace_campaign', 'usd_to_ars', 'has a usd_to_ars column');
select has_column('public', 'marketplace_campaign', 'stroops_per_usd', 'has a stroops_per_usd column');

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.marketplace_campaign', 'select'), false, 'anon cannot read marketplace_campaign');
select is(has_table_privilege('authenticated', 'public.marketplace_campaign', 'select'), false, 'authenticated cannot read marketplace_campaign');
select is(has_table_privilege('service_role', 'public.marketplace_campaign', 'select'), true, 'service role can read marketplace_campaign');

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------
-- Two published campaigns (one with an assessment, one without), a campaign
-- still pending deployment, and a settled campaign. Only the first two are
-- published.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('e1111111-1111-4111-8111-111111111111', 'market-a@example.test', '{"role": "PYME", "display_name": "Market A"}'::jsonb, '{}'::jsonb),
  ('e2222222-2222-4222-8222-222222222222', 'market-b@example.test', '{"role": "PYME", "display_name": "Market B"}'::jsonb, '{}'::jsonb),
  ('e3333333-3333-4333-8333-333333333333', 'market-c@example.test', '{"role": "PYME", "display_name": "Market C"}'::jsonb, '{}'::jsonb),
  ('e4444444-4444-4444-8444-444444444444', 'market-d@example.test', '{"role": "PYME", "display_name": "Market D"}'::jsonb, '{}'::jsonb);

insert into public.businesses (owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share)
values
  ('e1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20111111111', 'Alimentos', 'CABA', 'Panadería artesanal', 5000000, 5),
  ('e2222222-2222-4222-8222-222222222222', 'Panadería Norte', '20222222222', 'Alimentos', 'Córdoba', 'Panadería artesanal', 8000000, 3),
  ('e3333333-3333-4333-8333-333333333333', 'Panadería Oeste', '20333333333', 'Alimentos', 'Mendoza', 'Panadería artesanal', 6000000, 4),
  ('e4444444-4444-4444-8444-444444444444', 'Panadería Sur', '20444444444', 'Alimentos', 'Rosario', 'Panadería artesanal', 7000000, 6);

insert into public.application_review (application_id, state, last_correlation_id)
values
  ('a1111111-1111-4111-8111-111111111111', 'approved', 'b1111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222', 'approved', 'b2222222-2222-4222-8222-222222222222'),
  ('a3333333-3333-4333-8333-333333333333', 'approved', 'b3333333-3333-4333-8333-333333333333'),
  ('a4444444-4444-4444-8444-444444444444', 'approved', 'b4444444-4444-4444-8444-444444444444');

insert into public.sme_request (application_id, sme_reference, declared_total_ars, period_start, period_end, correlation_id, owner_user_id)
values
  ('a1111111-1111-4111-8111-111111111111', 'sme:A', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-aaaaaaaaaaaa', 'e1111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222', 'sme:B', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-bbbbbbbbbbbb', 'e2222222-2222-4222-8222-222222222222'),
  ('a3333333-3333-4333-8333-333333333333', 'sme:C', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-cccccccccccc', 'e3333333-3333-4333-8333-333333333333'),
  ('a4444444-4444-4444-8444-444444444444', 'sme:D', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-dddddddddddd', 'e4444444-4444-4444-8444-444444444444');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address, sme_account_id,
  goal_stroops, deadline, state, total_stroops, reconciliation_status, last_reconciled_at,
  last_correlation_id, fx_rate_version, usd_to_ars, stroops_per_usd
) values
  (
    'c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'CAAAAA', 'testnet', 'CBBBBB',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-12-01 00:00:00+00', 'open', 2500000, 'in_sync', now(),
    '11111111-1111-4111-8111-111111111111', 5, 1000000000, 10000000
  ),
  (
    'c2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'CAAAA2', 'testnet', 'CBBBB2',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-11-01 00:00:00+00', 'open', 0, 'in_sync', now(),
    '11111111-1111-4111-8111-222222222222', null, null, null
  ),
  (
    'c3333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333', 'CAAAA3', 'testnet', 'CBBBB3',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-20 00:00:00+00', 'open', 0, 'in_sync', now(),
    '11111111-1111-4111-8111-333333333333', 5, 1000000000, 10000000
  ),
  (
    'c4444444-4444-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444', 'CAAAA4', 'testnet', 'CBBBB4',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-10 00:00:00+00', 'settled', 10000000, 'in_sync', now(),
    '11111111-1111-4111-8111-444444444444', 5, 1000000000, 10000000
  );

insert into public.campaign_deployment (application_id, state, attempts, campaign_id, last_correlation_id)
values
  ('a1111111-1111-4111-8111-111111111111', 'confirmed', 1, 'c1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('a2222222-2222-4222-8222-222222222222', 'confirmed', 1, 'c2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-222222222222'),
  ('a3333333-3333-4333-8333-333333333333', 'pending', 0, null, '11111111-1111-4111-8111-333333333333'),
  ('a4444444-4444-4444-8444-444444444444', 'confirmed', 1, 'c4444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-444444444444');

insert into public.application_assessment (application_id, attempt_id, assessment, metadata, correlation_id)
values (
  'a1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  '{"assessmentId":"asm_mkt_001","riskBand":"medium","confidence":0.72}'::jsonb,
  '{}'::jsonb,
  'f1111111-1111-4111-8111-111111111111'
);

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as.

set local role service_role;

select is(
  (select count(*)::int from public.marketplace_campaign),
  2,
  'only the two published campaigns are listed'
);

select is(
  (select string_agg(name, ',' order by deadline) from public.marketplace_campaign),
  'Panadería Norte,Panadería Sol',
  'the listing carries one row per published campaign'
);

select is(
  (select name from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'Panadería Sol',
  'the company name comes from businesses'
);
select is(
  (select sector from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'Alimentos',
  'the company sector comes from businesses'
);
select is(
  (select city from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'CABA',
  'the company city comes from businesses'
);
select is(
  (select goal_ars from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  5000000::bigint,
  'the goal ARS comes from businesses.goal_ars'
);
select is(
  (select revenue_share from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  5::numeric,
  'the revenue share comes from businesses.revenue_share'
);
select is(
  (select total_stroops from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  2500000::bigint,
  'the raised total is the campaign mirror'
);
select is(
  (select goal_stroops from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  10000000::bigint,
  'the goal stroops is the campaign mirror'
);
select is(
  (select deadline from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  timestamptz '2026-12-01 00:00:00+00',
  'the close date is the campaign deadline'
);
select is(
  (select risk_band from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  'medium',
  'the risk band comes from the AI assessment'
);
select is(
  (select risk_confidence from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  '0.72',
  'the risk confidence comes from the AI assessment'
);
select is(
  (select fx_rate_version from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  5::bigint,
  'the FX rate version snapshot is exposed'
);
select is(
  (select usd_to_ars from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  1000000000::bigint,
  'the usd_to_ars snapshot is exposed'
);
select is(
  (select stroops_per_usd from public.marketplace_campaign where campaign_id = 'c1111111-1111-4111-8111-111111111111'),
  10000000::bigint,
  'the stroops_per_usd snapshot is exposed'
);

select is(
  (select risk_band from public.marketplace_campaign where campaign_id = 'c2222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without an assessment exposes a null risk band'
);
select is(
  (select risk_confidence from public.marketplace_campaign where campaign_id = 'c2222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without an assessment exposes a null risk confidence'
);
select is(
  (select fx_rate_version from public.marketplace_campaign where campaign_id = 'c2222222-2222-4222-8222-222222222222'),
  null,
  'a campaign without a rate snapshot exposes nulls'
);

select is(
  (select count(*)::int from public.marketplace_campaign where campaign_id = 'c3333333-3333-4333-8333-333333333333'),
  0,
  'a campaign with a pending deployment is not published'
);
select is(
  (select count(*)::int from public.marketplace_campaign where campaign_id = 'c4444444-4444-4444-8444-444444444444'),
  0,
  'a settled campaign is not published'
);

reset role;

select * from finish();
