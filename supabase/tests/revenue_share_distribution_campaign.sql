begin;

select plan(12);

-- T5a: a distribution is derived from one settled campaign, so it records which.
select has_column(
  'public', 'revenue_share_distribution', 'campaign_id',
  'distribution carries the campaign it was derived from'
);
select col_type_is(
  'public', 'revenue_share_distribution', 'campaign_id', 'uuid',
  'campaign_id is a uuid'
);
select col_is_null(
  'public', 'revenue_share_distribution', 'campaign_id',
  'campaign_id is nullable so distributions recorded before the link stay valid'
);
select fk_ok(
  'public', 'revenue_share_distribution', 'campaign_id',
  'public', 'campaign', 'campaign_id',
  'campaign_id references campaign'
);
select has_index(
  'public', 'revenue_share_distribution', 'revenue_share_distribution_campaign_id_idx',
  'campaign_id is indexed'
);

select is(
  has_column_privilege('service_role', 'public.revenue_share_distribution', 'campaign_id', 'insert'),
  true,
  'service role can record the campaign link on insert'
);
select is(
  has_column_privilege('service_role', 'public.revenue_share_distribution', 'campaign_id', 'update'),
  false,
  'service role cannot rewrite the campaign link after insert'
);
select is(
  has_column_privilege('anon', 'public.revenue_share_distribution', 'campaign_id', 'select')
    or has_column_privilege('authenticated', 'public.revenue_share_distribution', 'campaign_id', 'select'),
  false,
  'anon and authenticated cannot read the campaign link'
);

insert into public.application_review (application_id, state, last_correlation_id)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'approved', 'aaaaaaaa-0000-4000-8000-000000000002');

insert into public.campaign (
  campaign_id, application_id, contract_address, network, token_contract_address,
  goal_stroops, deadline, state, total_stroops, reconciliation_status,
  last_reconciled_at, last_correlation_id, sme_account_id
) values (
  'aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet',
  'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
  1000, now() + interval '1 day', 'settled', 1000, 'in_sync', now(),
  'aaaaaaaa-0000-4000-8000-000000000002',
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
);

-- Written as the API writes it: through service_role, campaign link included.
set local role service_role;

select lives_ok(
  $$
    insert into public.revenue_share_distribution (
      distribution_id, state, network, network_passphrase, source_account_id,
      source_sequence, expires_at, signed_xdr, transaction_hash, application_id,
      campaign_id, last_correlation_id
    ) values (
      'aaaaaaaa-0000-4000-8000-000000000004', 'submitted', 'testnet',
      'Test SDF Network ; September 2015',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '1', now() + interval '15 minutes', 'xdr', 'hash-campaign-link',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000003',
      'aaaaaaaa-0000-4000-8000-000000000002'
    )
  $$,
  'a distribution can be inserted with its campaign link'
);

select throws_ok(
  $$
    update public.revenue_share_distribution
       set campaign_id = null
     where distribution_id = 'aaaaaaaa-0000-4000-8000-000000000004'
  $$,
  '42501',
  null,
  'the campaign link cannot be rewritten by the service role'
);

reset role;

select throws_ok(
  $$
    insert into public.revenue_share_distribution (
      distribution_id, state, network, network_passphrase, source_account_id,
      source_sequence, expires_at, signed_xdr, transaction_hash, campaign_id,
      last_correlation_id
    ) values (
      'aaaaaaaa-0000-4000-8000-000000000005', 'submitted', 'testnet', 'p',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '1', now(), 'xdr', 'hash-unknown-campaign',
      'aaaaaaaa-0000-4000-8000-0000000000ff',
      'aaaaaaaa-0000-4000-8000-000000000002'
    )
  $$,
  '23503',
  null,
  'a distribution cannot point at a campaign that does not exist'
);

delete from public.campaign where campaign_id = 'aaaaaaaa-0000-4000-8000-000000000003';

select is(
  (select campaign_id from public.revenue_share_distribution
    where distribution_id = 'aaaaaaaa-0000-4000-8000-000000000004'),
  null::uuid,
  'deleting the campaign keeps the distribution evidence and clears the link'
);

select * from finish();

rollback;
