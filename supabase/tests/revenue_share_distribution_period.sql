begin;

select plan(12);

-- T5a-F: one distribution per campaign and period. The period the API derived
-- is persisted on the row and a partial unique index refuses a second
-- non-failed distribution for the same (campaign, period).
select has_column(
  'public', 'revenue_share_distribution', 'period',
  'distribution carries the period it settles'
);
select col_type_is(
  'public', 'revenue_share_distribution', 'period', 'text',
  'period is text (YYYY-MM)'
);
select col_is_null(
  'public', 'revenue_share_distribution', 'period',
  'period is nullable so distributions recorded before the column stay valid'
);
select has_index(
  'public', 'revenue_share_distribution', 'revenue_share_distribution_campaign_period_key',
  'campaign and period are unique among non-failed distributions'
);
select is(
  has_column_privilege('service_role', 'public.revenue_share_distribution', 'period', 'insert'),
  true,
  'service role can record the period on insert'
);
select is(
  has_column_privilege('service_role', 'public.revenue_share_distribution', 'period', 'update'),
  false,
  'service role cannot rewrite the period after insert'
);

insert into public.application_review (application_id, state, last_correlation_id)
values ('bbbbbbbb-0000-4000-8000-000000000001', 'approved', 'bbbbbbbb-0000-4000-8000-000000000002');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address,
  goal_stroops, deadline, state, total_stroops, reconciliation_status,
  last_reconciled_at, last_correlation_id, sme_account_id
) values (
  'bbbbbbbb-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001',
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet',
  'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
  1000, now() + interval '1 day', 'settled', 1000, 'in_sync', now(),
  'bbbbbbbb-0000-4000-8000-000000000002',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
);

set local role service_role;

select lives_ok(
  $$
    insert into public.revenue_share_distribution (
      distribution_id, state, network, network_passphrase, source_account_id,
      source_sequence, expires_at, signed_xdr, transaction_hash, campaign_id,
      period, last_correlation_id
    ) values (
      'bbbbbbbb-0000-4000-8000-000000000004', 'submitted', 'testnet', 'p',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '1', now() + interval '15 minutes', 'xdr', 'hash-period-1',
      'bbbbbbbb-0000-4000-8000-000000000003', '2026-08',
      'bbbbbbbb-0000-4000-8000-000000000002'
    )
  $$,
  'a distribution can be inserted with its period'
);

select throws_ok(
  $$
    insert into public.revenue_share_distribution (
      distribution_id, state, network, network_passphrase, source_account_id,
      source_sequence, expires_at, signed_xdr, transaction_hash, campaign_id,
      period, last_correlation_id
    ) values (
      'bbbbbbbb-0000-4000-8000-000000000005', 'submitted', 'testnet', 'p',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '2', now() + interval '15 minutes', 'xdr', 'hash-period-2',
      'bbbbbbbb-0000-4000-8000-000000000003', '2026-08',
      'bbbbbbbb-0000-4000-8000-000000000002'
    )
  $$,
  '23505',
  null,
  'a second non-failed distribution for the same campaign and period is refused'
);

select lives_ok(
  $$
    insert into public.revenue_share_distribution (
      distribution_id, state, network, network_passphrase, source_account_id,
      source_sequence, expires_at, signed_xdr, transaction_hash, campaign_id,
      period, last_correlation_id
    ) values (
      'bbbbbbbb-0000-4000-8000-000000000006', 'submitted', 'testnet', 'p',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '3', now() + interval '15 minutes', 'xdr', 'hash-period-3',
      'bbbbbbbb-0000-4000-8000-000000000003', '2026-09',
      'bbbbbbbb-0000-4000-8000-000000000002'
    )
  $$,
  'another period of the same campaign is allowed'
);

select throws_ok(
  $$
    update public.revenue_share_distribution
       set period = '2026-07'
     where distribution_id = 'bbbbbbbb-0000-4000-8000-000000000004'
  $$,
  '42501',
  null,
  'the period cannot be rewritten by the service role'
);

-- A failed distribution frees its slot: the retry is the next insert.
update public.revenue_share_distribution
   set state = 'failed', failure_reason = 'tx_failed',
       last_correlation_id = 'bbbbbbbb-0000-4000-8000-000000000002'
 where distribution_id = 'bbbbbbbb-0000-4000-8000-000000000004';

select lives_ok(
  $$
    insert into public.revenue_share_distribution (
      distribution_id, state, network, network_passphrase, source_account_id,
      source_sequence, expires_at, signed_xdr, transaction_hash, campaign_id,
      period, last_correlation_id
    ) values (
      'bbbbbbbb-0000-4000-8000-000000000007', 'submitted', 'testnet', 'p',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '4', now() + interval '15 minutes', 'xdr', 'hash-period-4',
      'bbbbbbbb-0000-4000-8000-000000000003', '2026-08',
      'bbbbbbbb-0000-4000-8000-000000000002'
    )
  $$,
  'a failed distribution allows a retry for the same campaign and period'
);

reset role;

select throws_ok(
  $$
    insert into public.revenue_share_distribution (
      distribution_id, state, network, network_passphrase, source_account_id,
      source_sequence, expires_at, signed_xdr, transaction_hash, campaign_id,
      period, last_correlation_id
    ) values (
      'bbbbbbbb-0000-4000-8000-000000000008', 'submitted', 'testnet', 'p',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '5', now() + interval '15 minutes', 'xdr', 'hash-period-5',
      'bbbbbbbb-0000-4000-8000-000000000003', '2026-8',
      'bbbbbbbb-0000-4000-8000-000000000002'
    )
  $$,
  '23514',
  null,
  'period must be YYYY-MM'
);

select * from finish();

rollback;
