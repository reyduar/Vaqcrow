begin;

select plan(67);

-- Investor portfolio read model (Feature #426, WU1).
--
-- `public.investor_portfolio_position` joins the investor's own contributions
-- to a **deployed** campaign (not filtered to `state = 'open'`, so settled and
-- refundable positions are included) and its company/photo.
-- `public.investor_portfolio_distribution` lists the distribution recipients
-- addressed to the investor. Both are service_role-only: RLS on the base tables
-- stays the enforcement point, `security_invoker = true` keeps the views from
-- bypassing it, and there is no client (anon/authenticated) path at all.

-- Structure -------------------------------------------------------------------

select has_view('public', 'investor_portfolio_position', 'investor_portfolio_position view exists');
select has_view('public', 'investor_portfolio_distribution', 'investor_portfolio_distribution view exists');

select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.investor_portfolio_position'::regclass),
  true,
  'investor_portfolio_position runs with security_invoker (honors base-table privileges)'
);
select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.investor_portfolio_distribution'::regclass),
  true,
  'investor_portfolio_distribution runs with security_invoker (honors base-table privileges)'
);

select has_column('public', 'investor_portfolio_position', 'investor_account_id', 'position carries the investor account');
select has_column('public', 'investor_portfolio_position', 'campaign_id', 'position carries the campaign id');
select has_column('public', 'investor_portfolio_position', 'name', 'position carries the company name');
select has_column('public', 'investor_portfolio_position', 'sector', 'position carries the sector');
select has_column('public', 'investor_portfolio_position', 'city', 'position carries the city');
select has_column('public', 'investor_portfolio_position', 'goal_ars', 'position carries the goal ARS');
select has_column('public', 'investor_portfolio_position', 'total_stroops', 'position carries the raised stroops');
select has_column('public', 'investor_portfolio_position', 'goal_stroops', 'position carries the goal stroops');
select has_column('public', 'investor_portfolio_position', 'deadline', 'position carries the deadline');
select has_column('public', 'investor_portfolio_position', 'state', 'position carries the mirror state');
select has_column('public', 'investor_portfolio_position', 'contract_address', 'position carries the vault address');
select has_column('public', 'investor_portfolio_position', 'contribution_stroops', 'position carries the investor contribution');
select has_column('public', 'investor_portfolio_position', 'fx_rate_version', 'position carries the rate snapshot version');
select has_column('public', 'investor_portfolio_position', 'usd_to_ars', 'position carries the usd_to_ars snapshot');
select has_column('public', 'investor_portfolio_position', 'stroops_per_usd', 'position carries the stroops_per_usd snapshot');
select has_column('public', 'investor_portfolio_position', 'image_object_path', 'position carries the image object path (#414/WU3)');
select has_column('public', 'investor_portfolio_position', 'image_content_type', 'position carries the image content type (#414/WU3)');

select has_column('public', 'investor_portfolio_distribution', 'investor_account_id', 'distribution carries the investor account');
select has_column('public', 'investor_portfolio_distribution', 'distribution_id', 'distribution carries the distribution id');
select has_column('public', 'investor_portfolio_distribution', 'campaign_id', 'distribution carries the campaign id');
select has_column('public', 'investor_portfolio_distribution', 'campaign_name', 'distribution carries the campaign name');
select has_column('public', 'investor_portfolio_distribution', 'period', 'distribution carries the period');
select has_column('public', 'investor_portfolio_distribution', 'amount_stroops', 'distribution carries the allocation');
select has_column('public', 'investor_portfolio_distribution', 'state', 'distribution carries the persisted state');
select has_column('public', 'investor_portfolio_distribution', 'recorded_at', 'distribution carries the recorded time');
-- Feature #438/WU3 appends the distribution's own Testnet hash at the end.
select has_column('public', 'investor_portfolio_distribution', 'transaction_hash', 'distribution carries its Testnet transaction hash (#438/WU3)');

-- `public.investor_contribution_transaction` (#438/WU3): one row per
-- **observed** contribute transaction, with its campaign name and vault, so the
-- portfolio and the report can link each contribution to the explorer.
select has_view('public', 'investor_contribution_transaction', 'investor_contribution_transaction view exists');
select is(
  (select (reloptions @> array['security_invoker=true']) from pg_class where oid = 'public.investor_contribution_transaction'::regclass),
  true,
  'investor_contribution_transaction runs with security_invoker (honors base-table privileges)'
);
select has_column('public', 'investor_contribution_transaction', 'investor_account_id', 'contribution transaction carries the investor account');
select has_column('public', 'investor_contribution_transaction', 'transaction_hash', 'contribution transaction carries its hash');
select has_column('public', 'investor_contribution_transaction', 'campaign_id', 'contribution transaction carries the campaign id');
select has_column('public', 'investor_contribution_transaction', 'campaign_name', 'contribution transaction carries the PyME name');
select has_column('public', 'investor_contribution_transaction', 'vault_address', 'contribution transaction carries the vault address');
select has_column('public', 'investor_contribution_transaction', 'amount_stroops', 'contribution transaction carries its amount');
select has_column('public', 'investor_contribution_transaction', 'observed_at', 'contribution transaction carries its observation time');

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.investor_portfolio_position', 'select'), false, 'anon cannot read the position view');
select is(has_table_privilege('authenticated', 'public.investor_portfolio_position', 'select'), false, 'authenticated cannot read the position view');
select is(has_table_privilege('service_role', 'public.investor_portfolio_position', 'select'), true, 'service role can read the position view');
select is(has_table_privilege('anon', 'public.investor_portfolio_distribution', 'select'), false, 'anon cannot read the distribution view');
select is(has_table_privilege('authenticated', 'public.investor_portfolio_distribution', 'select'), false, 'authenticated cannot read the distribution view');
select is(has_table_privilege('service_role', 'public.investor_portfolio_distribution', 'select'), true, 'service role can read the distribution view');
select is(has_table_privilege('anon', 'public.investor_contribution_transaction', 'select'), false, 'anon cannot read the contribution transaction view');
select is(has_table_privilege('authenticated', 'public.investor_contribution_transaction', 'select'), false, 'authenticated cannot read the contribution transaction view');
select is(has_table_privilege('service_role', 'public.investor_contribution_transaction', 'select'), true, 'service role can read the contribution transaction view');

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------
-- Two PyMEs with deployed campaigns: campaign C1 is open, campaign C2 is
-- settled. Investor A contributed to both, investor B only to C1. Only C1 has
-- distributions: one confirmed (A and B) and one submitted (A). C2 has a
-- contribution but no distribution, so its aggregate is NULL.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'pf1@example.test', '{"role": "PYME", "display_name": "Panadería Sol"}'::jsonb, '{}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'pf2@example.test', '{"role": "PYME", "display_name": "Panadería Norte"}'::jsonb, '{}'::jsonb);

insert into public.businesses (owner_user_id, name, cuit, sector, city, description, goal_ars, revenue_share, created_at)
values
  ('a1111111-1111-4111-8111-111111111111', 'Panadería Sol', '20111111111', 'Alimentos', 'CABA', 'Panadería artesanal', 5000000, 5, timestamptz '2024-03-01 00:00:00+00'),
  ('a2222222-2222-4222-8222-222222222222', 'Panadería Norte', '20222222222', 'Alimentos', 'Córdoba', 'Panadería artesanal', 8000000, 3, timestamptz '2024-04-01 00:00:00+00');

insert into public.application_review (application_id, state, last_correlation_id)
values
  ('81111111-1111-4111-8111-111111111111', 'approved', 'b1111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222', 'approved', 'b2222222-2222-4222-8222-222222222222');

insert into public.sme_request (application_id, sme_reference, declared_total_ars, period_start, period_end, correlation_id, owner_user_id)
values
  ('81111111-1111-4111-8111-111111111111', 'sme:P1', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222', 'sme:P2', 1000000, '2026-01', '2026-08', '11111111-1111-4111-8111-bbbbbbbbbbbb', 'a2222222-2222-4222-8222-222222222222');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address, sme_account_id,
  goal_stroops, deadline, state, total_stroops, reconciliation_status, last_reconciled_at,
  last_correlation_id, fx_rate_version, usd_to_ars, stroops_per_usd
) values
  (
    '81111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111',
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM', 'testnet',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-12-01 00:00:00+00', 'open', 3500000, 'in_sync', now(),
    '11111111-1111-4111-8111-111111111111', 5, 1000000000, 10000000
  ),
  (
    '82222222-2222-4222-8222-222222222222', '82222222-2222-4222-8222-222222222222',
    'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', 'testnet',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    10000000, timestamptz '2026-10-10 00:00:00+00', 'settled', 10000000, 'in_sync', now(),
    '11111111-1111-4111-8111-222222222222', 5, 1000000000, 10000000
  );

insert into public.campaign_deployment (application_id, state, attempts, campaign_id, last_correlation_id)
values
  ('81111111-1111-4111-8111-111111111111', 'confirmed', 1, '81111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222', 'confirmed', 1, '82222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-222222222222');

insert into public.pyme_document (id, owner_user_id, kind, object_path, name, size_bytes, content_type, created_at)
values (
  'a1111111-1111-4111-8111-1111111117f2', 'a1111111-1111-4111-8111-111111111111',
  'photo', 'a1111111-1111-4111-8111-111111111111/photo/frente.jpg',
  'frente.jpg', 200, 'image/jpeg', timestamptz '2026-02-01 00:00:00+00'
);

insert into public.campaign_contribution (campaign_id, investor_account_id, amount_stroops, last_observed_at, last_correlation_id)
values
  ('81111111-1111-4111-8111-111111111111', 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 1500000, now(), '11111111-1111-4111-8111-aaaa00000001'),
  ('81111111-1111-4111-8111-111111111111', 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 2000000, now(), '11111111-1111-4111-8111-aaaa00000002'),
  ('82222222-2222-4222-8222-222222222222', 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 3000000, now(), '11111111-1111-4111-8111-aaaa00000003');

insert into public.revenue_share_distribution (
  distribution_id, state, network, network_passphrase, source_account_id, source_sequence,
  expires_at, signed_xdr, transaction_hash, last_correlation_id, campaign_id, period,
  confirmed_at, ledger_sequence
) values (
  'd1111111-1111-4111-8111-111111111101', 'confirmed', 'testnet', 'Test SDF Network ; September 2015',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '1',
  timestamptz '2026-12-31 00:00:00+00', 'AAAA', 'hash-confirmed-1', '11111111-1111-4111-8111-cccc00000001',
  '81111111-1111-4111-8111-111111111111', '2026-06', timestamptz '2026-07-01 00:00:00+00', 123
);

insert into public.revenue_share_distribution (
  distribution_id, state, network, network_passphrase, source_account_id, source_sequence,
  expires_at, signed_xdr, transaction_hash, last_correlation_id, campaign_id, period
) values (
  'd1111111-1111-4111-8111-111111111102', 'submitted', 'testnet', 'Test SDF Network ; September 2015',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '2',
  timestamptz '2026-12-31 00:00:00+00', 'BBBB', 'hash-submitted-1', '11111111-1111-4111-8111-cccc00000002',
  '81111111-1111-4111-8111-111111111111', '2026-07'
);

insert into public.revenue_share_distribution_recipient (distribution_id, position, account_id, amount_stroops)
values
  ('d1111111-1111-4111-8111-111111111101', 0, 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 12500000),
  ('d1111111-1111-4111-8111-111111111101', 1, 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 5000000),
  ('d1111111-1111-4111-8111-111111111102', 0, 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 4000000);

-- Contribute transactions (#438/WU1 table). The 54-character fixture accounts
-- above predate its strict account check, so two valid accounts are used here:
-- X has an observed transaction on each campaign plus one never observed; Y
-- has one observed transaction on C1.
insert into public.campaign_contribution_transaction (
  transaction_hash, campaign_id, investor_account_id, amount_stroops, observed_at, last_correlation_id
) values
  (repeat('a', 64), '81111111-1111-4111-8111-111111111111', 'G' || repeat('X', 55), 1500000, timestamptz '2026-03-15 00:00:00+00', '11111111-1111-4111-8111-eeee00000001'),
  (repeat('b', 64), '82222222-2222-4222-8222-222222222222', 'G' || repeat('X', 55), 3000000, timestamptz '2026-04-15 00:00:00+00', '11111111-1111-4111-8111-eeee00000002'),
  (repeat('c', 64), '81111111-1111-4111-8111-111111111111', 'G' || repeat('X', 55), 700000, null, '11111111-1111-4111-8111-eeee00000003'),
  (repeat('d', 64), '81111111-1111-4111-8111-111111111111', 'G' || repeat('Y', 55), 2000000, timestamptz '2026-03-20 00:00:00+00', '11111111-1111-4111-8111-eeee00000004');

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as.

set local role service_role;

select is(
  (select count(*)::int from public.investor_portfolio_position),
  3,
  'one row per contribution across every deployed campaign'
);

select is(
  (select count(*)::int from public.investor_portfolio_position where campaign_id = '82222222-2222-4222-8222-222222222222'),
  1,
  'a settled campaign position is included (the view is not filtered to open)'
);

select is(
  (select count(*)::int from public.investor_portfolio_position where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  2,
  'the investor scope keeps only that investor''s own positions'
);
select is(
  (select count(*)::int from public.investor_portfolio_position where investor_account_id = 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'),
  1,
  'another investor''s positions are a separate scope'
);

select is(
  (select image_object_path from public.investor_portfolio_position where campaign_id = '81111111-1111-4111-8111-111111111111' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  'a1111111-1111-4111-8111-111111111111/photo/frente.jpg',
  'the position carries the campaign''s photo for the API to proxy'
);
select is(
  (select image_object_path from public.investor_portfolio_position where campaign_id = '82222222-2222-4222-8222-222222222222'),
  null,
  'a company with no photo exposes no image (sin dato)'
);

select is(
  (select count(*)::int from public.investor_portfolio_distribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  2,
  'the distribution scope keeps only that investor''s recipient rows'
);
select is(
  (select count(*)::int from public.investor_portfolio_distribution where investor_account_id = 'GINVESTORBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'),
  1,
  'another investor''s distribution is a separate scope'
);

select is(
  (select state from public.investor_portfolio_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  'confirmed',
  'the persisted distribution state is exposed'
);
select is(
  (select campaign_name from public.investor_portfolio_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  'Panadería Sol',
  'the distribution resolves its campaign name'
);
select is(
  (select period from public.investor_portfolio_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  '2026-06',
  'the distribution exposes its settled period'
);

select is(
  (select sum(amount_stroops)::bigint from public.investor_portfolio_distribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' and state = 'confirmed'),
  12500000::bigint,
  'summing confirmed recipient rows yields the received total'
);
select is(
  (select sum(amount_stroops)::bigint from public.investor_portfolio_distribution where investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' and campaign_id = '82222222-2222-4222-8222-222222222222'),
  null::bigint,
  'a contribution with no distribution aggregates to null, never zero'
);

select is(
  (select transaction_hash from public.investor_portfolio_distribution where distribution_id = 'd1111111-1111-4111-8111-111111111101' and investor_account_id = 'GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  'hash-confirmed-1',
  'the distribution exposes its own Testnet transaction hash (#438/WU3)'
);

select is(
  (select count(*)::int from public.investor_contribution_transaction where investor_account_id = 'G' || repeat('X', 55)),
  2,
  'the investor scope keeps only that investor''s observed contribute transactions'
);
select is(
  (select count(*)::int from public.investor_contribution_transaction where investor_account_id = 'G' || repeat('X', 55) and transaction_hash = repeat('d', 64)),
  0,
  'another investor''s contribution hash never appears in the investor''s scope'
);
select is(
  (select count(*)::int from public.investor_contribution_transaction where transaction_hash = repeat('c', 64)),
  0,
  'a submitted but never observed transaction is not evidence of a contribution'
);
select is(
  (select campaign_name from public.investor_contribution_transaction where transaction_hash = repeat('a', 64)),
  'Panadería Sol',
  'the contribution transaction resolves its PyME name'
);
select is(
  (select vault_address from public.investor_contribution_transaction where transaction_hash = repeat('a', 64)),
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
  'the contribution transaction carries its campaign''s vault address'
);

reset role;

select * from finish();

rollback;
