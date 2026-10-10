begin;

select plan(39);

select has_table('public', 'campaign', 'campaign mirror exists');
select has_table('public', 'campaign_contribution', 'contribution mirror exists');
select has_table('public', 'campaign_refund_contact', 'refund contact store exists');
select has_table('public', 'funding_intent_legacy', 'legacy funding evidence remains readable');
select hasnt_table('public', 'funding_intent', 'retired funding table is not active');

select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign'::regclass),
  true,
  'campaign has row-level security enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign_contribution'::regclass),
  true,
  'campaign contributions have row-level security enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign_refund_contact'::regclass),
  true,
  'refund contacts have row-level security enabled'
);

select is(
  has_table_privilege('anon', 'public.campaign', 'select'),
  false,
  'anon cannot read campaign mirrors'
);
select is(
  has_table_privilege('authenticated', 'public.campaign_contribution', 'insert'),
  false,
  'authenticated cannot write contribution mirrors'
);
select is(
  has_table_privilege('anon', 'public.campaign_refund_contact', 'select'),
  false,
  'anon cannot read refund contact PII'
);
select is(
  has_table_privilege('service_role', 'public.campaign', 'update'),
  true,
  'service role can reconcile campaigns'
);
select is(
  has_table_privilege('service_role', 'public.campaign_contribution', 'update'),
  true,
  'service role can reconcile contributions'
);
select is(
  has_table_privilege('service_role', 'public.campaign_refund_contact', 'insert'),
  true,
  'service role can save refund contacts'
);
select is(
  has_table_privilege('service_role', 'public.funding_intent_legacy', 'select'),
  true,
  'service role can inspect legacy evidence'
);

-- U2: the SME's Stellar account id, captured when the vault opens (D7).
select has_column('public', 'campaign', 'sme_account_id', 'campaign mirror carries the SME account id');
select col_not_null('public', 'campaign', 'sme_account_id', 'sme account id is required');

insert into public.application_review (application_id, state, last_correlation_id)
values ('99999999-9999-4999-8999-999999999999', 'approved', '99999999-9999-4999-8999-999999999998');

select throws_ok(
  $$
    insert into public.campaign (
      campaign_id, application_id, contract_address, network, token_contract_address,
      goal_stroops, deadline, state, total_stroops, reconciliation_status,
      last_reconciled_at, last_correlation_id, sme_account_id
    ) values (
      '99999999-9999-4999-8999-999999999997', '99999999-9999-4999-8999-999999999999',
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet',
      'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
      1000, now() + interval '1 day', 'open', 0, 'in_sync', now(),
      '99999999-9999-4999-8999-999999999996', 'not-a-stellar-account'
    )
  $$,
  '23514',
  null,
  'the format check rejects a malformed sme account id'
);

select lives_ok(
  $$
    insert into public.campaign (
      campaign_id, application_id, contract_address, network, token_contract_address,
      goal_stroops, deadline, state, total_stroops, reconciliation_status,
      last_reconciled_at, last_correlation_id, sme_account_id
    ) values (
      '99999999-9999-4999-8999-999999999995', '99999999-9999-4999-8999-999999999999',
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF', 'testnet',
      'CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDWHF',
      1000, now() + interval '1 day', 'open', 0, 'in_sync', now(),
      '99999999-9999-4999-8999-999999999994',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    )
  $$,
  'the format check accepts a valid G... sme account id'
);

-- Feature #438/WU1: the vault deploy hash on the campaign mirror and the
-- per-transaction contribution record (20261009150000).
select has_column('public', 'campaign', 'deploy_transaction_hash', 'campaign mirror carries the deploy hash');
select col_is_null('public', 'campaign', 'deploy_transaction_hash', 'deploy hash is nullable (pre-existing rows stay NULL)');
select is(
  (select deploy_transaction_hash from public.campaign where campaign_id = '99999999-9999-4999-8999-999999999995'),
  null,
  'a campaign written without a deploy hash keeps it NULL'
);
select throws_ok(
  $$
    update public.campaign set deploy_transaction_hash = 'not-a-hash'
    where campaign_id = '99999999-9999-4999-8999-999999999995'
  $$,
  '23514',
  null,
  'the format check rejects a malformed deploy hash'
);
select lives_ok(
  $$
    update public.campaign set deploy_transaction_hash = repeat('a', 64)
    where campaign_id = '99999999-9999-4999-8999-999999999995'
  $$,
  'the format check accepts a 64-char lowercase hex deploy hash'
);

select has_table('public', 'campaign_contribution_transaction', 'per-transaction contribution record exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign_contribution_transaction'::regclass),
  true,
  'contribution transactions have row-level security enabled'
);
select is(
  has_table_privilege('anon', 'public.campaign_contribution_transaction', 'select,insert,update,delete'),
  false,
  'anon has no privilege on contribution transactions'
);
select is(
  has_table_privilege('authenticated', 'public.campaign_contribution_transaction', 'select,insert,update,delete'),
  false,
  'authenticated has no privilege on contribution transactions'
);
select is(
  has_table_privilege('service_role', 'public.campaign_contribution_transaction', 'select,insert'),
  true,
  'service role can read and record contribution transactions'
);
select is(
  has_table_privilege('service_role', 'public.campaign_contribution_transaction', 'delete'),
  false,
  'service role cannot delete a contribution transaction'
);
select is(
  has_column_privilege('service_role', 'public.campaign_contribution_transaction', 'amount_stroops', 'update'),
  false,
  'the recorded amount is unwritable after insert'
);
select is(
  has_column_privilege('service_role', 'public.campaign_contribution_transaction', 'observed_at', 'update'),
  true,
  'service role can stamp the confirmation'
);
select throws_ok(
  $$
    insert into public.campaign_contribution_transaction (
      transaction_hash, campaign_id, investor_account_id, amount_stroops, last_correlation_id
    ) values (
      repeat('b', 64), '99999999-9999-4999-8999-999999999995',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 0,
      '99999999-9999-4999-8999-999999999993'
    )
  $$,
  '23514',
  null,
  'a zero-amount contribution transaction is refused'
);

-- The API's insert-or-ignore, run as the API role: a replayed submission
-- (same hash) is a no-op rather than an error or a second row.
set local role service_role;
insert into public.campaign_contribution_transaction (
  transaction_hash, campaign_id, investor_account_id, amount_stroops, last_correlation_id
) values (
  repeat('c', 64), '99999999-9999-4999-8999-999999999995',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 5000,
  '99999999-9999-4999-8999-999999999992'
) on conflict (transaction_hash) do nothing;
insert into public.campaign_contribution_transaction (
  transaction_hash, campaign_id, investor_account_id, amount_stroops, last_correlation_id
) values (
  repeat('c', 64), '99999999-9999-4999-8999-999999999995',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 9999,
  '99999999-9999-4999-8999-999999999991'
) on conflict (transaction_hash) do nothing;
update public.campaign_contribution_transaction
  set observed_at = now(), last_correlation_id = '99999999-9999-4999-8999-999999999990'
  where transaction_hash = repeat('c', 64) and observed_at is null;
reset role;

select is(
  (select count(*)::int from public.campaign_contribution_transaction where transaction_hash = repeat('c', 64)),
  1,
  'a replayed submission does not add a second row'
);
select is(
  (select amount_stroops from public.campaign_contribution_transaction where transaction_hash = repeat('c', 64)),
  5000::bigint,
  'a replayed submission does not rewrite the first record'
);
select isnt(
  (select observed_at from public.campaign_contribution_transaction where transaction_hash = repeat('c', 64)),
  null,
  'the API role can confirm a recorded contribution'
);

-- Exercise the documented reversal in an isolated transaction. The rollback
-- keeps the test database at the forward migration state for later tests.
-- A later migration (#422) adds a view over campaign and campaign_contribution,
-- so it is reversed before the mirrors it depends on.
drop view if exists public.marketplace_campaign_detail;
-- Feature #426/WU1 adds portfolio views over campaign, campaign_contribution,
-- revenue_share_distribution and its recipient rows, so they are reversed
-- before the mirrors they depend on.
drop view if exists public.investor_portfolio_position;
drop view if exists public.investor_portfolio_distribution;
-- Feature #430/WU1 adds report views over campaign, campaign_contribution,
-- revenue_share_distribution and business_sales_period, so they are reversed
-- before the mirrors they depend on.
drop view if exists public.investor_report_contribution;
drop view if exists public.investor_report_distribution;
drop view if exists public.investor_report_sales_by_pyme;
-- Feature #434/WU1 adds my-campaign views over campaign, sme_request,
-- businesses, business_sales_period and revenue_share_distribution, so they are
-- reversed before the mirrors they depend on.
drop view if exists public.my_campaign_summary;
drop view if exists public.my_campaign_distribution;
drop view if exists public.my_campaign_sales;
-- Feature #438/WU3 adds a view over campaign_contribution_transaction, campaign,
-- sme_request and businesses, so it is reversed before the mirrors it depends on.
drop view if exists public.investor_contribution_transaction;
-- The #422/WU2b sales-period table backs that detail view (and references
-- businesses); reverse it here too, after the view that depends on it.
drop table if exists public.business_sales_period;
drop table public.campaign_refund_contact;
drop table public.campaign_contribution;
-- Later migrations that reference campaign must be reversed first
-- (20260930173441 adds revenue_share_distribution.campaign_id).
alter table public.revenue_share_distribution
  drop constraint if exists revenue_share_distribution_campaign_id_fkey;
-- A later migration (#414) adds a view over campaign, so the campaign mirror is
-- reversed only after that view.
drop view if exists public.marketplace_campaign;
-- A later migration (#414/WU2) adds campaign_favorite with a foreign key to
-- campaign, so it is reversed before the campaign mirror.
drop table if exists public.campaign_favorite;
-- Feature #438/WU1 adds campaign_contribution_transaction with a foreign key to
-- campaign (and campaign.deploy_transaction_hash); reverse both before the
-- campaign mirror.
drop table if exists public.campaign_contribution_transaction;
alter table public.campaign drop column if exists deploy_transaction_hash;
drop table public.campaign;
drop function public.set_campaign_updated_at();
alter table public.funding_intent_legacy rename to funding_intent;

select hasnt_table('public', 'campaign_contribution_transaction', 'reversal removes the contribution transaction record');
select hasnt_table('public', 'campaign', 'reversal removes campaign mirror');
select has_table('public', 'funding_intent', 'reversal restores the legacy table name');

select * from finish();

rollback;
