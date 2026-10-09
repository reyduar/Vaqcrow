begin;

select plan(60);

-- PyME "Mi campaña" dashboard read model (Feature #434, WU1).
--
-- `public.my_campaign_summary` exposes each campaign the owner owns, with the
-- company's name/sector/city/goal, the campaign's state, progress, vault,
-- deadline and FX snapshot; `public.my_campaign_distribution` exposes each
-- campaign distribution with its recipients summed; `public.my_campaign_sales`
-- exposes each declared-sales month of a campaign's company. All three are
-- service_role-only: RLS on the base tables stays the enforcement point,
-- `security_invoker = true` keeps the views from bypassing it, and there is no
-- client (anon/authenticated) path at all.

-- Structure -------------------------------------------------------------------

select has_view('public', 'my_campaign_summary', 'my_campaign_summary view exists');
select has_view('public', 'my_campaign_distribution', 'my_campaign_distribution view exists');
select has_view('public', 'my_campaign_sales', 'my_campaign_sales view exists');

select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.my_campaign_summary'::regclass),
  true,
  'my_campaign_summary runs with security_invoker (honors base-table privileges)'
);
select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.my_campaign_distribution'::regclass),
  true,
  'my_campaign_distribution runs with security_invoker (honors base-table privileges)'
);
select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.my_campaign_sales'::regclass),
  true,
  'my_campaign_sales runs with security_invoker (honors base-table privileges)'
);

select has_column('public', 'my_campaign_summary', 'owner_user_id', 'summary carries the owner');
select has_column('public', 'my_campaign_summary', 'campaign_id', 'summary carries the campaign id');
select has_column('public', 'my_campaign_summary', 'name', 'summary carries the company name');
select has_column('public', 'my_campaign_summary', 'sector', 'summary carries the sector');
select has_column('public', 'my_campaign_summary', 'city', 'summary carries the city');
select has_column('public', 'my_campaign_summary', 'goal_ars', 'summary carries the goal in ARS');
select has_column('public', 'my_campaign_summary', 'total_stroops', 'summary carries the raised total');
select has_column('public', 'my_campaign_summary', 'goal_stroops', 'summary carries the goal in stroops');
select has_column('public', 'my_campaign_summary', 'vault_address', 'summary carries the vault address');
select has_column('public', 'my_campaign_summary', 'state', 'summary carries the campaign state');
select has_column('public', 'my_campaign_summary', 'deadline', 'summary carries the deadline');
select has_column('public', 'my_campaign_summary', 'created_at', 'summary carries the creation time for ordering');
select has_column('public', 'my_campaign_summary', 'fx_rate_version', 'summary carries the FX snapshot version');
select has_column('public', 'my_campaign_summary', 'usd_to_ars', 'summary carries the ARS rate snapshot');
select has_column('public', 'my_campaign_summary', 'stroops_per_usd', 'summary carries the stroop rate snapshot');
select has_column('public', 'my_campaign_summary', 'contributors_count', 'summary carries the contributor count');
select has_column('public', 'my_campaign_summary', 'image_object_path', 'summary carries the image object path');
select has_column('public', 'my_campaign_summary', 'image_content_type', 'summary carries the image content type');

select has_column('public', 'my_campaign_distribution', 'owner_user_id', 'distribution carries the owner');
select has_column('public', 'my_campaign_distribution', 'campaign_id', 'distribution carries the campaign id');
select has_column('public', 'my_campaign_distribution', 'distribution_id', 'distribution carries the distribution id');
select has_column('public', 'my_campaign_distribution', 'period', 'distribution carries the period');
select has_column('public', 'my_campaign_distribution', 'state', 'distribution carries the persisted state');
select has_column('public', 'my_campaign_distribution', 'amount_stroops', 'distribution carries the summed allocation');

select has_column('public', 'my_campaign_sales', 'owner_user_id', 'sales row carries the owner');
select has_column('public', 'my_campaign_sales', 'campaign_id', 'sales row carries the campaign id');
select has_column('public', 'my_campaign_sales', 'period', 'sales row carries the period');
select has_column('public', 'my_campaign_sales', 'sales_ars', 'sales row carries the declared amount');
select has_column('public', 'my_campaign_sales', 'status', 'sales row carries the status');

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.my_campaign_summary', 'select'), false, 'anon cannot read the summary view');
select is(has_table_privilege('authenticated', 'public.my_campaign_summary', 'select'), false, 'authenticated cannot read the summary view');
select is(has_table_privilege('service_role', 'public.my_campaign_summary', 'select'), true, 'service role can read the summary view');
select is(has_table_privilege('anon', 'public.my_campaign_distribution', 'select'), false, 'anon cannot read the distribution view');
select is(has_table_privilege('authenticated', 'public.my_campaign_distribution', 'select'), false, 'authenticated cannot read the distribution view');
select is(has_table_privilege('service_role', 'public.my_campaign_distribution', 'select'), true, 'service role can read the distribution view');
select is(has_table_privilege('anon', 'public.my_campaign_sales', 'select'), false, 'anon cannot read the sales view');
select is(has_table_privilege('authenticated', 'public.my_campaign_sales', 'select'), false, 'authenticated cannot read the sales view');
select is(has_table_privilege('service_role', 'public.my_campaign_sales', 'select'), true, 'service role can read the sales view');

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------
-- Two PyMEs. Owner A owns two campaigns (one with an FX snapshot and a photo,
-- one legacy without either) and two declared-sales months; owner B owns one
-- campaign with its own sale. Only A's first campaign has a distribution, paid
-- to two recipients.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'mc1@example.test', '{"role": "PYME", "display_name": "Panadería Sol"}'::jsonb, '{}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'mc2@example.test', '{"role": "PYME", "display_name": "Panadería Norte"}'::jsonb, '{}'::jsonb);

insert into public.businesses (id, owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share, created_at)
values
  ('b1111111-1111-4111-8111-111111111101', 'a1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20111111111', 'Alimentos', 'CABA', 'Panadería artesanal', 5000000, 5, timestamptz '2024-03-01 00:00:00+00'),
  ('b2222222-2222-4222-8222-222222222202', 'a2222222-2222-4222-8222-222222222222', 'Panadería Norte', '20222222222', 'Textil', 'Córdoba', 'Taller textil', 8000000, 3, timestamptz '2024-04-01 00:00:00+00');

insert into public.pyme_document (id, owner_user_id, kind, object_path, name, size_bytes, content_type, created_at)
values (
  'd1111111-1111-4111-8111-111111111101', 'a1111111-1111-4111-8111-111111111111', 'photo',
  'a1111111/photo/sol.jpg', 'sol.jpg', 1024, 'image/jpeg', timestamptz '2024-03-02 00:00:00+00'
);

insert into public.application_review (application_id, state, last_correlation_id)
values
  ('81111111-1111-4111-8111-111111111111', 'approved', 'b1111111-1111-4111-8111-111111111101'),
  ('82222222-2222-4222-8222-222222222222', 'approved', 'b2222222-2222-4222-8222-222222222202'),
  ('83333333-3333-4333-8333-333333333333', 'approved', 'b2222222-2222-4222-8222-222222222202');

insert into public.sme_request (application_id, sme_reference, declared_total_ars, period_start, period_end, correlation_id, owner_user_id)
values
  ('81111111-1111-4111-8111-111111111111', 'sme:MC1', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222', 'sme:MC2', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-bbbbbbbbbbbb', 'a1111111-1111-4111-8111-111111111111'),
  ('83333333-3333-4333-8333-333333333333', 'sme:MC3', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-cccccccccccc', 'a2222222-2222-4222-8222-222222222222');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address, sme_account_id,
  goal_stroops, deadline, state, total_stroops, reconciliation_status, last_reconciled_at, last_correlation_id,
  fx_rate_version, usd_to_ars, stroops_per_usd, created_at
) values
  (
    '81111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111',
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM', 'testnet',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-12-01 00:00:00+00', 'open', 1250000, 'in_sync', now(), '11111111-1111-4111-8111-111111111111',
    5, 1000000000, 10000000, timestamptz '2026-03-01 00:00:00+00'
  ),
  (
    '82222222-2222-4222-8222-222222222222', '82222222-2222-4222-8222-222222222222',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', 'testnet',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-10 00:00:00+00', 'settled', 0, 'in_sync', now(), '11111111-1111-4111-8111-222222222222',
    null, null, null, timestamptz '2026-04-01 00:00:00+00'
  ),
  (
    '83333333-3333-4333-8333-333333333333', '83333333-3333-4333-8333-333333333333',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF', 'testnet',
    'CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDWHF', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-12-01 00:00:00+00', 'open', 1000000, 'in_sync', now(), '11111111-1111-4111-8111-333333333333',
    null, null, null, timestamptz '2026-05-01 00:00:00+00'
  );

insert into public.campaign_contribution (campaign_id, investor_account_id, amount_stroops, last_observed_at, last_correlation_id)
values
  ('81111111-1111-4111-8111-111111111111', 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 500000, timestamptz '2026-03-15 00:00:00+00', '11111111-1111-4111-8111-aaaa00000001'),
  ('81111111-1111-4111-8111-111111111111', 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 750000, timestamptz '2026-04-01 00:00:00+00', '11111111-1111-4111-8111-aaaa00000002');

insert into public.revenue_share_distribution (
  distribution_id, state, network, network_passphrase, source_account_id, source_sequence,
  expires_at, signed_xdr, transaction_hash, last_correlation_id, campaign_id, period, confirmed_at, ledger_sequence, created_at
) values (
  'd1111111-1111-4111-8111-111111111101', 'confirmed', 'testnet', 'Test SDF Network ; September 2015',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '1',
  timestamptz '2026-12-31 00:00:00+00', 'AAAA', 'hash-mc-confirmed', '11111111-1111-4111-8111-dddd00000001',
  '81111111-1111-4111-8111-111111111111', '2026-06', timestamptz '2026-07-01 00:00:00+00', 123, timestamptz '2026-06-30 00:00:00+00'
);

insert into public.revenue_share_distribution_recipient (distribution_id, position, account_id, amount_stroops)
values
  ('d1111111-1111-4111-8111-111111111101', 0, 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 5000000),
  ('d1111111-1111-4111-8111-111111111101', 1, 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 7500000);

insert into public.business_sales_period (business_id, period, sales_ars, status, source)
values
  ('b1111111-1111-4111-8111-111111111101', '2026-05', 8000000, 'reported', 'SIMULADO:test'),
  ('b1111111-1111-4111-8111-111111111101', '2026-06', null, 'missing', 'SIMULADO:test'),
  ('b2222222-2222-4222-8222-222222222202', '2026-06', 5000000, 'reported', 'SIMULADO:test');

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as.

set local role service_role;

select is(
  (select count(*)::int from public.my_campaign_summary where owner_user_id = 'a1111111-1111-4111-8111-111111111111'),
  2,
  'the owner sees every campaign it owns, current and historic'
);
select is(
  (select count(*)::int from public.my_campaign_summary where owner_user_id = 'a2222222-2222-4222-8222-222222222222'),
  1,
  'another PyME''s campaigns are a separate scope'
);
select is(
  (select name from public.my_campaign_summary where campaign_id = '81111111-1111-4111-8111-111111111111'),
  'Panadería Sol',
  'the campaign resolves its owner''s company name'
);
select is(
  (select contributors_count::int from public.my_campaign_summary where campaign_id = '81111111-1111-4111-8111-111111111111'),
  2,
  'the summary counts the campaign contributors'
);
select is(
  (select image_object_path from public.my_campaign_summary where campaign_id = '81111111-1111-4111-8111-111111111111'),
  'a1111111/photo/sol.jpg',
  'the summary exposes the PyME photo object path'
);
select is(
  (select fx_rate_version from public.my_campaign_summary where campaign_id = '82222222-2222-4222-8222-222222222222'),
  null,
  'a legacy campaign without a snapshot exposes null FX columns'
);
select is(
  (select image_object_path from public.my_campaign_summary where campaign_id = '83333333-3333-4333-8333-333333333333'),
  null,
  'a campaign with no photo exposes a null image'
);
select is(
  (select count(*)::int from public.my_campaign_distribution where owner_user_id = 'a1111111-1111-4111-8111-111111111111'),
  1,
  'the distribution scope keeps only the owner''s rows'
);
select is(
  (select amount_stroops::bigint from public.my_campaign_distribution where campaign_id = '81111111-1111-4111-8111-111111111111'),
  12500000::bigint,
  'a distribution sums its recipients'' allocations'
);
select is(
  (select state from public.my_campaign_distribution where campaign_id = '81111111-1111-4111-8111-111111111111'),
  'confirmed',
  'the distribution exposes its persisted state'
);
select is(
  (select period from public.my_campaign_distribution where campaign_id = '81111111-1111-4111-8111-111111111111'),
  '2026-06',
  'the distribution exposes its settled period'
);
select is(
  (select count(*)::int from public.my_campaign_sales where owner_user_id = 'a1111111-1111-4111-8111-111111111111'),
  4,
  'the sales scope keeps every declared month of each owned campaign'
);
select is(
  (select sales_ars from public.my_campaign_sales where campaign_id = '81111111-1111-4111-8111-111111111111' and period = '2026-06'),
  null,
  'a missing month carries a null sale, never zero'
);
select is(
  (select sales_ars::bigint from public.my_campaign_sales where owner_user_id = 'a2222222-2222-4222-8222-222222222222' and period = '2026-06'),
  5000000::bigint,
  'another PyME''s sales scope is separate and populated'
);
select is(
  (select count(*)::int from public.my_campaign_summary where owner_user_id = 'a1111111-1111-4111-8111-111111111111' and campaign_id = '83333333-3333-4333-8333-333333333333'),
  0,
  'owner A cannot see owner B''s campaign'
);
select is(
  (select count(*)::int from public.my_campaign_distribution where owner_user_id = 'a2222222-2222-4222-8222-222222222222'),
  0,
  'owner B sees no distributions of owner A'
);

reset role;

select * from finish();

rollback;
