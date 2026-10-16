begin;

select plan(8);

-- A fully withdrawn or refunded contribution leaves the mirror (Feature #571).
--
-- When the vault reports an investor's running contribution back at zero, the
-- API's reconcile deletes that investor's `campaign_contribution` row instead
-- of skipping it, so the portfolio stops listing the campaign. The API connects
-- as service_role, which therefore needs DELETE on the table, and nobody else
-- gains anything. The delete cascades to that investor's
-- `campaign_refund_contact` (nothing is left to refund) and leaves the
-- campaign's contribution transaction hashes in place.

-- Access control --------------------------------------------------------------

select is(
  has_table_privilege('service_role', 'public.campaign_contribution', 'delete'),
  true,
  'service role can delete a contribution mirror row'
);
select is(
  has_table_privilege('anon', 'public.campaign_contribution', 'delete'),
  false,
  'anon cannot delete a contribution'
);
select is(
  has_table_privilege('authenticated', 'public.campaign_contribution', 'delete'),
  false,
  'authenticated cannot delete a contribution'
);

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------
-- One open campaign with two investors. Investor A also left a refund contact
-- and one observed contribute transaction.

insert into public.application_review (application_id, state, last_correlation_id)
values ('85711111-1111-4111-8111-111111111111', 'approved', 'b5711111-1111-4111-8111-111111111111');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address, sme_account_id,
  goal_stroops, deadline, state, total_stroops, reconciliation_status, last_reconciled_at,
  last_correlation_id, fx_rate_version, usd_to_ars, stroops_per_usd
) values (
  '85711111-1111-4111-8111-111111111111', '85711111-1111-4111-8111-111111111111',
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM', 'testnet',
  'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  1000000000, timestamptz '2026-12-01 00:00:00+00', 'open', 300000000, 'in_sync', now(),
  '15711111-1111-4111-8111-111111111111', 5, 1000000000, 10000000
);

insert into public.campaign_contribution (campaign_id, investor_account_id, amount_stroops, last_observed_at, last_correlation_id)
values
  ('85711111-1111-4111-8111-111111111111', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 100000000, now(), '15711111-1111-4111-8111-aaaa00000001'),
  ('85711111-1111-4111-8111-111111111111', 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', 200000000, now(), '15711111-1111-4111-8111-aaaa00000002');

insert into public.campaign_refund_contact (campaign_id, investor_account_id, notification_email, last_correlation_id)
values ('85711111-1111-4111-8111-111111111111', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'a@example.test', '15711111-1111-4111-8111-aaaa00000003');

insert into public.campaign_contribution_transaction (
  transaction_hash, campaign_id, investor_account_id, amount_stroops, observed_at, last_correlation_id
) values (
  repeat('a', 64), '85711111-1111-4111-8111-111111111111', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 100000000, now(),
  '15711111-1111-4111-8111-aaaa00000004'
);

-- The withdraw, as the API runs it --------------------------------------------

set local role service_role;
delete from public.campaign_contribution
where campaign_id = '85711111-1111-4111-8111-111111111111'
  and investor_account_id = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
reset role;

select is(
  (select count(*)::int from public.campaign_contribution
    where campaign_id = '85711111-1111-4111-8111-111111111111' and investor_account_id = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
  0,
  'the withdrawn investor''s contribution row is gone'
);
select is(
  (select amount_stroops from public.campaign_contribution
    where campaign_id = '85711111-1111-4111-8111-111111111111' and investor_account_id = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF'),
  200000000::bigint,
  'another investor''s contribution to the same campaign is untouched'
);
select is(
  (select count(*)::int from public.campaign_refund_contact
    where campaign_id = '85711111-1111-4111-8111-111111111111' and investor_account_id = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
  0,
  'the withdrawn investor''s refund contact goes with the contribution'
);
select is(
  (select count(*)::int from public.campaign_contribution_transaction where transaction_hash = repeat('a', 64)),
  1,
  'the contribution transaction hash is kept'
);
select is(
  (select count(*)::int from public.investor_portfolio_position
    where campaign_id = '85711111-1111-4111-8111-111111111111' and investor_account_id = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
  0,
  'the portfolio no longer lists the campaign for the withdrawn investor'
);

select * from finish();
rollback;
