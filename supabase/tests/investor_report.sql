begin;

select plan(54);

-- Investor report read model (Feature #430, WU1).
--
-- `public.investor_report_contribution` exposes each contribution with the
-- `coalesce(last_observed_at, created_at)` observed mark;
-- `public.investor_report_distribution` exposes each recipient row with its
-- persisted state, confirmation time and the PyME's declared sale for that
-- period; `public.investor_report_sales_by_pyme` exposes each declared-sales
-- month of a PyME the investor holds a position in. All three are
-- service_role-only: RLS on the base tables stays the enforcement point,
-- `security_invoker = true` keeps the views from bypassing it, and there is no
-- client (anon/authenticated) path at all.

-- Structure -------------------------------------------------------------------

select has_view('public', 'investor_report_contribution', 'investor_report_contribution view exists');
select has_view('public', 'investor_report_distribution', 'investor_report_distribution view exists');
select has_view('public', 'investor_report_sales_by_pyme', 'investor_report_sales_by_pyme view exists');

select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.investor_report_contribution'::regclass),
  true,
  'investor_report_contribution runs with security_invoker (honors base-table privileges)'
);
select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.investor_report_distribution'::regclass),
  true,
  'investor_report_distribution runs with security_invoker (honors base-table privileges)'
);
select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.investor_report_sales_by_pyme'::regclass),
  true,
  'investor_report_sales_by_pyme runs with security_invoker (honors base-table privileges)'
);

select has_column('public', 'investor_report_contribution', 'investor_account_id', 'contribution carries the investor account');
select has_column('public', 'investor_report_contribution', 'campaign_id', 'contribution carries the campaign id');
select has_column('public', 'investor_report_contribution', 'contribution_stroops', 'contribution carries the stroop amount');
select has_column('public', 'investor_report_contribution', 'observed_at', 'contribution carries the observed mark');

select has_column('public', 'investor_report_distribution', 'investor_account_id', 'distribution carries the investor account');
select has_column('public', 'investor_report_distribution', 'distribution_id', 'distribution carries the distribution id');
select has_column('public', 'investor_report_distribution', 'campaign_id', 'distribution carries the campaign id');
select has_column('public', 'investor_report_distribution', 'campaign_name', 'distribution carries the PyME name');
select has_column('public', 'investor_report_distribution', 'period', 'distribution carries the settled period');
select has_column('public', 'investor_report_distribution', 'amount_stroops', 'distribution carries the allocation');
select has_column('public', 'investor_report_distribution', 'state', 'distribution carries the persisted state');
select has_column('public', 'investor_report_distribution', 'confirmed_at', 'distribution carries the confirmation time');
select has_column('public', 'investor_report_distribution', 'recorded_at', 'distribution carries the recorded time');
select has_column('public', 'investor_report_distribution', 'declared_sales_ars', 'distribution carries the declared sale for its period');
select has_column('public', 'investor_report_distribution', 'transaction_hash', 'distribution carries its Testnet transaction hash (#438/WU3)');

select has_column('public', 'investor_report_sales_by_pyme', 'investor_account_id', 'sales row carries the investor account');
select has_column('public', 'investor_report_sales_by_pyme', 'campaign_id', 'sales row carries the campaign id');
select has_column('public', 'investor_report_sales_by_pyme', 'name', 'sales row carries the PyME name');
select has_column('public', 'investor_report_sales_by_pyme', 'sector', 'sales row carries the sector');
select has_column('public', 'investor_report_sales_by_pyme', 'period', 'sales row carries the period');
select has_column('public', 'investor_report_sales_by_pyme', 'sales_ars', 'sales row carries the declared amount');
select has_column('public', 'investor_report_sales_by_pyme', 'status', 'sales row carries the status');

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.investor_report_contribution', 'select'), false, 'anon cannot read the contribution view');
select is(has_table_privilege('authenticated', 'public.investor_report_contribution', 'select'), false, 'authenticated cannot read the contribution view');
select is(has_table_privilege('service_role', 'public.investor_report_contribution', 'select'), true, 'service role can read the contribution view');
select is(has_table_privilege('anon', 'public.investor_report_distribution', 'select'), false, 'anon cannot read the distribution view');
select is(has_table_privilege('authenticated', 'public.investor_report_distribution', 'select'), false, 'authenticated cannot read the distribution view');
select is(has_table_privilege('service_role', 'public.investor_report_distribution', 'select'), true, 'service role can read the distribution view');
select is(has_table_privilege('anon', 'public.investor_report_sales_by_pyme', 'select'), false, 'anon cannot read the sales view');
select is(has_table_privilege('authenticated', 'public.investor_report_sales_by_pyme', 'select'), false, 'authenticated cannot read the sales view');
select is(has_table_privilege('service_role', 'public.investor_report_sales_by_pyme', 'select'), true, 'service role can read the sales view');

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------
-- Two PyMEs with deployed campaigns and declared sales months. Investor A
-- contributed to both campaigns; investor B only to campaign C1. Only C1 has
-- a confirmed (A), a submitted (A) and a failed (B) distribution; a legacy
-- confirmed distribution with no campaign/period belongs to A.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'ir1@example.test', '{"role": "PYME", "display_name": "Panadería Sol"}'::jsonb, '{}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'ir2@example.test', '{"role": "PYME", "display_name": "Panadería Norte"}'::jsonb, '{}'::jsonb);

insert into public.businesses (id, owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share, created_at)
values
  ('b1111111-1111-4111-8111-111111111101', 'a1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20111111111', 'Alimentos', 'CABA', 'Panadería artesanal', 5000000, 5, timestamptz '2024-03-01 00:00:00+00'),
  ('b2222222-2222-4222-8222-222222222202', 'a2222222-2222-4222-8222-222222222222', 'Panadería Norte', '20222222222', 'Textil', 'Córdoba', 'Taller textil', 8000000, 3, timestamptz '2024-04-01 00:00:00+00');

insert into public.application_review (application_id, state, last_correlation_id)
values
  ('81111111-1111-4111-8111-111111111111', 'approved', 'b1111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222', 'approved', 'b2222222-2222-4222-8222-222222222222');

insert into public.sme_request (application_id, sme_reference, declared_total_ars, period_start, period_end, correlation_id, owner_user_id)
values
  ('81111111-1111-4111-8111-111111111111', 'sme:IR1', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222', 'sme:IR2', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-bbbbbbbbbbbb', 'a2222222-2222-4222-8222-222222222222');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address, sme_account_id,
  goal_stroops, deadline, state, total_stroops, reconciliation_status, last_reconciled_at, last_correlation_id
) values
  (
    '81111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111',
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM', 'testnet',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-12-01 00:00:00+00', 'open', 3500000, 'in_sync', now(), '11111111-1111-4111-8111-111111111111'
  ),
  (
    '82222222-2222-4222-8222-222222222222', '82222222-2222-4222-8222-222222222222',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', 'testnet',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-10 00:00:00+00', 'open', 1000000, 'in_sync', now(), '11111111-1111-4111-8111-222222222222'
  );

insert into public.campaign_deployment (application_id, state, attempts, campaign_id, last_correlation_id)
values
  ('81111111-1111-4111-8111-111111111111', 'confirmed', 1, '81111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222', 'confirmed', 1, '82222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-222222222222');

insert into public.campaign_contribution (campaign_id, investor_account_id, amount_stroops, last_observed_at, last_correlation_id, created_at)
values
  ('81111111-1111-4111-8111-111111111111', 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 1500000, timestamptz '2026-03-15 00:00:00+00', '11111111-1111-4111-8111-aaaa00000001', timestamptz '2026-03-01 00:00:00+00'),
  ('81111111-1111-4111-8111-111111111111', 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 2000000, timestamptz '2026-04-01 00:00:00+00', '11111111-1111-4111-8111-aaaa00000002', timestamptz '2026-03-20 00:00:00+00'),
  ('82222222-2222-4222-8222-222222222222', 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 3000000, timestamptz '2026-05-01 00:00:00+00', '11111111-1111-4111-8111-aaaa00000003', timestamptz '2026-04-25 00:00:00+00');

insert into public.business_sales_period (business_id, period, sales_ars, status, source)
values
  ('b1111111-1111-4111-8111-111111111101', '2026-05', 8000000, 'reported', 'SIMULADO:test'),
  ('b1111111-1111-4111-8111-111111111101', '2026-06', 9000000, 'reported', 'SIMULADO:test'),
  ('b1111111-1111-4111-8111-111111111101', '2026-07', null, 'missing', 'SIMULADO:test'),
  ('b1111111-1111-4111-8111-111111111101', '2026-08', 15000000, 'anomalous', 'SIMULADO:test'),
  ('b2222222-2222-4222-8222-222222222202', '2026-06', 5000000, 'reported', 'SIMULADO:test'),
  ('b2222222-2222-4222-8222-222222222202', '2026-07', 6000000, 'reported', 'SIMULADO:test');

insert into public.revenue_share_distribution (
  distribution_id, state, network, network_passphrase, source_account_id, source_sequence,
  expires_at, signed_xdr, transaction_hash, last_correlation_id, campaign_id, period, confirmed_at, ledger_sequence, created_at
) values (
  'd1111111-1111-4111-8111-111111111101', 'confirmed', 'testnet', 'Test SDF Network ; September 2015',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '1',
  timestamptz '2026-12-31 00:00:00+00', 'AAAA', 'hash-ir-confirmed', '11111111-1111-4111-8111-cccc00000001',
  '81111111-1111-4111-8111-111111111111', '2026-06', timestamptz '2026-07-01 00:00:00+00', 123, timestamptz '2026-06-30 00:00:00+00'
);

insert into public.revenue_share_distribution (
  distribution_id, state, network, network_passphrase, source_account_id, source_sequence,
  expires_at, signed_xdr, transaction_hash, last_correlation_id, campaign_id, period, created_at
) values (
  'd1111111-1111-4111-8111-111111111102', 'submitted', 'testnet', 'Test SDF Network ; September 2015',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '2',
  timestamptz '2026-12-31 00:00:00+00', 'BBBB', 'hash-ir-submitted', '11111111-1111-4111-8111-cccc00000002',
  '81111111-1111-4111-8111-111111111111', '2026-07', timestamptz '2026-07-10 00:00:00+00'
);

insert into public.revenue_share_distribution (
  distribution_id, state, network, network_passphrase, source_account_id, source_sequence,
  expires_at, signed_xdr, transaction_hash, last_correlation_id, campaign_id, period, failure_reason, created_at
) values (
  'd1111111-1111-4111-8111-111111111103', 'failed', 'testnet', 'Test SDF Network ; September 2015',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '3',
  timestamptz '2026-12-31 00:00:00+00', 'CCCC', 'hash-ir-failed', '11111111-1111-4111-8111-cccc00000003',
  '82222222-2222-4222-8222-222222222222', '2026-05', 'network_error', timestamptz '2026-05-20 00:00:00+00'
);

insert into public.revenue_share_distribution (
  distribution_id, state, network, network_passphrase, source_account_id, source_sequence,
  expires_at, signed_xdr, transaction_hash, last_correlation_id, confirmed_at, ledger_sequence, created_at
) values (
  'd1111111-1111-4111-8111-111111111104', 'confirmed', 'testnet', 'Test SDF Network ; September 2015',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '4',
  timestamptz '2026-12-31 00:00:00+00', 'DDDD', 'hash-ir-legacy', '11111111-1111-4111-8111-cccc00000004',
  timestamptz '2026-02-02 00:00:00+00', 100, timestamptz '2026-02-01 00:00:00+00'
);

insert into public.revenue_share_distribution_recipient (distribution_id, position, account_id, amount_stroops)
values
  ('d1111111-1111-4111-8111-111111111101', 0, 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 12500000),
  ('d1111111-1111-4111-8111-111111111102', 0, 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 4000000),
  ('d1111111-1111-4111-8111-111111111103', 0, 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 1000000),
  ('d1111111-1111-4111-8111-111111111104', 0, 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 7000000);

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as.

set local role service_role;

select is(
  (select count(*)::int from public.investor_report_contribution),
  3,
  'one row per contribution'
);
select is(
  (select observed_at from public.investor_report_contribution where campaign_id = '81111111-1111-4111-8111-111111111111' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  timestamptz '2026-03-15 00:00:00+00',
  'the contribution observed mark is the last observation time'
);

select is(
  (select count(*)::int from public.investor_report_distribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  3,
  'the distribution scope keeps only that investor''s recipient rows'
);
select is(
  (select state from public.investor_report_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  'confirmed',
  'the persisted distribution state is exposed'
);
select is(
  (select declared_sales_ars from public.investor_report_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  9000000::bigint,
  'a confirmed distribution resolves the declared sale of its period'
);
select isnt(
  (select confirmed_at from public.investor_report_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  null,
  'a confirmed distribution exposes its confirmation time'
);
select is(
  (select period from public.investor_report_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111104' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  null,
  'a legacy distribution keeps a null period'
);
select is(
  (select declared_sales_ars from public.investor_report_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111104' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  null,
  'a legacy distribution exposes no declared sale (sin dato)'
);

select is(
  (select count(*)::int from public.investor_report_sales_by_pyme where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  6,
  'the investor sees every declared-sales month of the PyMEs it holds'
);
select is(
  (select sales_ars from public.investor_report_sales_by_pyme where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' and name = 'Panadería Sol' and period = '2026-07'),
  null,
  'a missing month carries a null sale, never zero'
);
select is(
  (select count(*)::int from public.investor_report_sales_by_pyme where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' and status = 'anomalous'),
  1,
  'an anomalous month keeps its status'
);
select is(
  (select count(*)::int from public.investor_report_sales_by_pyme where investor_account_id = 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'),
  4,
  'another investor''s sales scope is separate'
);

select is(
  (select sum(contribution_stroops)::bigint from public.investor_report_contribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  4500000::bigint,
  'summing the investor contributions yields the contributed total'
);
select is(
  (select count(distinct campaign_id)::int from public.investor_report_contribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  2,
  'the contributed total spans the investor''s distinct campaigns'
);
select is(
  (select sum(amount_stroops)::bigint from public.investor_report_distribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' and state = 'confirmed'),
  19500000::bigint,
  'summing confirmed recipient rows yields the distributed total'
);
select is(
  (select count(*)::int from public.investor_report_distribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' and state = 'submitted'),
  1,
  'the pending distribution count counts only submitted rows'
);
select is(
  (select transaction_hash from public.investor_report_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  'hash-ir-confirmed',
  'the distribution exposes its own Testnet transaction hash (#438/WU3)'
);

reset role;

select * from finish();

rollback;
