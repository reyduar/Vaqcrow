begin;

select plan(32);

-- Per-account campaign favorites (Feature #414, work unit WU2).
--
-- `public.campaign_favorite` is one row per (user, campaign) the user saved.
-- The API is the only writer and connects as `service_role`: the marketplace
-- listing itself stays public and cacheable, and favorites are fetched
-- separately for the signed-in user. There is no client write path and no
-- client read path — `authenticated`/`anon` hold no grant at all.
--
-- RLS is enabled with zero policies (defense in depth on an exposed schema):
-- only `service_role`, which bypasses RLS, reaches the table, and the API
-- scopes every query by the verified principal's `user_id`.
--
-- Reversal:
--   drop table if exists public.campaign_favorite;

-- Structure -------------------------------------------------------------------

select has_table('public', 'campaign_favorite', 'campaign_favorite table exists');

select has_column('public', 'campaign_favorite', 'user_id', 'campaign_favorite has a user_id column');
select has_column('public', 'campaign_favorite', 'campaign_id', 'campaign_favorite has a campaign_id column');
select has_column('public', 'campaign_favorite', 'created_at', 'campaign_favorite has a created_at column');

select col_type_is('public', 'campaign_favorite', 'user_id', 'uuid', 'user_id is a uuid');
select col_type_is('public', 'campaign_favorite', 'campaign_id', 'uuid', 'campaign_id is a uuid');
select col_type_is('public', 'campaign_favorite', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');

select col_not_null('public', 'campaign_favorite', 'user_id', 'a favorite always has an owner');
select col_not_null('public', 'campaign_favorite', 'campaign_id', 'a favorite always names a campaign');
select col_not_null('public', 'campaign_favorite', 'created_at', 'a favorite is always timestamped');

select col_has_default('public', 'campaign_favorite', 'created_at', 'created_at defaults to now()');

select has_pk('public', 'campaign_favorite', 'the (user_id, campaign_id) primary key exists');

select fk_ok(
  'public', 'campaign_favorite', 'campaign_id',
  'public', 'campaign', 'campaign_id',
  'campaign_favorite.campaign_id references campaign.campaign_id'
);

select has_index(
  'public', 'campaign_favorite', 'campaign_favorite_campaign_id_idx',
  'the campaign_id index for the FK cascade exists'
);

-- Access control: RLS on, zero policies, service_role only ----------------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.campaign_favorite'::regclass),
  true,
  'campaign_favorite has row-level security enabled'
);

select is(has_table_privilege('anon', 'public.campaign_favorite', 'select'), false, 'anon cannot read favorites');
select is(has_table_privilege('anon', 'public.campaign_favorite', 'insert'), false, 'anon cannot insert favorites');
select is(has_table_privilege('anon', 'public.campaign_favorite', 'delete'), false, 'anon cannot delete favorites');
select is(has_table_privilege('authenticated', 'public.campaign_favorite', 'select'), false, 'authenticated cannot read favorites');
select is(has_table_privilege('authenticated', 'public.campaign_favorite', 'insert'), false, 'authenticated cannot insert favorites');
select is(has_table_privilege('authenticated', 'public.campaign_favorite', 'delete'), false, 'authenticated cannot delete favorites');
select is(has_table_privilege('authenticated', 'public.campaign_favorite', 'update'), false, 'authenticated cannot update favorites');
select is(has_table_privilege('service_role', 'public.campaign_favorite', 'select'), true, 'service role can read favorites');
select is(has_table_privilege('service_role', 'public.campaign_favorite', 'insert'), true, 'service role can insert favorites');
select is(has_table_privilege('service_role', 'public.campaign_favorite', 'delete'), true, 'service role can delete favorites');
select is(has_table_privilege('service_role', 'public.campaign_favorite', 'update'), false, 'service role cannot update favorites');

-- Behavior: the unique key, the campaign FK and the cascade --------------------
-- Exercised as service_role, the role the API connects as, so the grants the
-- migration keeps are the ones under test.

insert into public.application_review (application_id, state, last_correlation_id)
values ('99999999-9999-4999-8999-999999999999', 'approved', '99999999-9999-4999-8999-999999999998');

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
);

set local role service_role;

select lives_ok(
  $$
    insert into public.campaign_favorite (user_id, campaign_id)
    values ('a1111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999995')
  $$,
  'service role can save a favorite'
);

select is(
  (select count(*)::int from public.campaign_favorite
    where user_id = 'a1111111-1111-4111-8111-111111111111'),
  1,
  'the favorite is stored once'
);

select throws_ok(
  $$
    insert into public.campaign_favorite (user_id, campaign_id)
    values ('a1111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999995')
  $$,
  '23505', null,
  'the same (user_id, campaign_id) cannot be favorited twice'
);

select is(
  (select count(*)::int from public.campaign_favorite
    where user_id = 'a1111111-1111-4111-8111-111111111111'),
  1,
  'the duplicate did not add a second row'
);

select throws_ok(
  $$
    insert into public.campaign_favorite (user_id, campaign_id)
    values ('a1111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999991')
  $$,
  '23503', null,
  'favoriting an unknown campaign violates the campaign foreign key'
);

reset role;

delete from public.campaign where campaign_id = '99999999-9999-4999-8999-999999999995';

select is(
  (select count(*)::int from public.campaign_favorite),
  0,
  'deleting a campaign cascades to its favorites'
);

select * from finish();

rollback;
