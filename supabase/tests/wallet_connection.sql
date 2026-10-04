begin;

select plan(42);

-- PyME Freighter wallet connection (Feature #406, Task #407 / T1a). This unit is
-- the database foundation only; the API challenge endpoint and the web
-- Freighter client land in later units.
--
-- `public.profile.stellar_public_key` is nullable and, when present, must be a
-- Stellar ed25519 public key (`G` + 55 base32 chars). `public.wallet_challenge`
-- is service_role-only: RLS is enabled and the grants are set explicitly in the
-- migration, with zero policies. `service_role` bypasses RLS, so the API is the
-- single issuer/consumer of the single-use challenge. There is no client
-- (anon/authenticated) path at all.

-- Structure: profile column ----------------------------------------------------

select has_column('public', 'profile', 'stellar_public_key', 'profile has a stellar_public_key column');
select col_type_is('public', 'profile', 'stellar_public_key', 'text', 'stellar_public_key is text');
select col_is_null(
  'public', 'profile', 'stellar_public_key',
  'stellar_public_key is nullable: a PyME has no key until it connects'
);

-- Structure: wallet_challenge --------------------------------------------------

select has_table('public', 'wallet_challenge', 'wallet_challenge table exists');
select has_column('public', 'wallet_challenge', 'challenge_id', 'wallet_challenge has a challenge_id column');
select has_column('public', 'wallet_challenge', 'owner_user_id', 'wallet_challenge has an owner_user_id column');
select has_column('public', 'wallet_challenge', 'nonce', 'wallet_challenge has a nonce column');
select has_column('public', 'wallet_challenge', 'created_at', 'wallet_challenge has a created_at column');
select has_column('public', 'wallet_challenge', 'expires_at', 'wallet_challenge has an expires_at column');
select has_column('public', 'wallet_challenge', 'consumed_at', 'wallet_challenge has a consumed_at column');

select col_not_null('public', 'wallet_challenge', 'owner_user_id', 'a challenge always belongs to an owner');
select col_not_null('public', 'wallet_challenge', 'nonce', 'a challenge always carries a nonce');
select col_not_null('public', 'wallet_challenge', 'expires_at', 'a challenge always expires');
select col_not_null('public', 'wallet_challenge', 'created_at', 'a challenge is always timestamped');
select col_is_null('public', 'wallet_challenge', 'consumed_at', 'consumed_at is null until the challenge is used');

select col_has_default('public', 'wallet_challenge', 'challenge_id', 'challenge_id generates its own uuid');
select col_has_default('public', 'wallet_challenge', 'created_at', 'created_at defaults to now()');

select fk_ok(
  'public', 'wallet_challenge', 'owner_user_id',
  'public', 'profile', 'user_id',
  'wallet_challenge.owner_user_id references profile.user_id'
);

select has_index(
  'public', 'wallet_challenge', 'wallet_challenge_owner_user_id_idx',
  'the owner foreign key is indexed'
);

-- Access control: RLS on, zero policies, nobody but service_role --------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.wallet_challenge'::regclass),
  true,
  'wallet_challenge has row-level security enabled'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'wallet_challenge'),
  0,
  'wallet_challenge has no policies: the API (service_role) is the only reader/writer'
);

select is(has_table_privilege('anon', 'public.wallet_challenge', 'select'), false, 'anon cannot read wallet_challenge');
select is(has_table_privilege('anon', 'public.wallet_challenge', 'insert'), false, 'anon cannot insert wallet_challenge');
select is(has_table_privilege('anon', 'public.wallet_challenge', 'update'), false, 'anon cannot update wallet_challenge');
select is(has_table_privilege('anon', 'public.wallet_challenge', 'delete'), false, 'anon cannot delete wallet_challenge');
select is(has_table_privilege('authenticated', 'public.wallet_challenge', 'select'), false, 'authenticated cannot read wallet_challenge');
select is(has_table_privilege('authenticated', 'public.wallet_challenge', 'insert'), false, 'authenticated cannot insert wallet_challenge');
select is(has_table_privilege('authenticated', 'public.wallet_challenge', 'update'), false, 'authenticated cannot update wallet_challenge');
select is(has_table_privilege('authenticated', 'public.wallet_challenge', 'delete'), false, 'authenticated cannot delete wallet_challenge');
select is(has_table_privilege('service_role', 'public.wallet_challenge', 'select'), true, 'service role can read wallet_challenge');
select is(has_table_privilege('service_role', 'public.wallet_challenge', 'insert'), true, 'service role can insert wallet_challenge');
select is(has_table_privilege('service_role', 'public.wallet_challenge', 'update'), true, 'service role can update wallet_challenge');
select is(has_table_privilege('service_role', 'public.wallet_challenge', 'delete'), true, 'service role can delete wallet_challenge');

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as, so the write grants
-- the migration actually keeps are the ones under test.

-- A profile is created by the auth.users signup trigger, so both the column and
-- the challenge FK are exercised against a real public.profile row.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'f1111111-1111-4111-8111-111111111111', 'wallet-owner@example.test',
  '{"role": "PYME", "display_name": "Wallet Owner"}'::jsonb, '{}'::jsonb
);

select is(
  (select stellar_public_key from public.profile where user_id = 'f1111111-1111-4111-8111-111111111111'),
  null::text,
  'a fresh profile has no wallet key'
);

set local role service_role;

update public.profile
  set stellar_public_key = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  where user_id = 'f1111111-1111-4111-8111-111111111111';

select is(
  (select stellar_public_key from public.profile where user_id = 'f1111111-1111-4111-8111-111111111111'),
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  'a valid G... public key is accepted and stored'
);

select throws_ok(
  $$update public.profile
      set stellar_public_key = 'gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      where user_id = 'f1111111-1111-4111-8111-111111111111'$$,
  '23514', null,
  'a key without the uppercase G prefix is rejected'
);

select throws_ok(
  $$update public.profile
      set stellar_public_key = 'G123'
      where user_id = 'f1111111-1111-4111-8111-111111111111'$$,
  '23514', null,
  'a key that is not 56 characters is rejected'
);

insert into public.wallet_challenge (owner_user_id, nonce, expires_at)
values (
  'f1111111-1111-4111-8111-111111111111', 'challenge-nonce-1',
  now() + interval '5 minutes'
);

select is(
  (select count(*)::int from public.wallet_challenge
    where nonce = 'challenge-nonce-1' and consumed_at is null),
  1,
  'a challenge is created unused'
);

update public.wallet_challenge set consumed_at = now() where nonce = 'challenge-nonce-1';

select is(
  (select count(*)::int from public.wallet_challenge
    where nonce = 'challenge-nonce-1' and consumed_at is not null),
  1,
  'a challenge is marked consumed so it cannot be replayed'
);

select throws_ok(
  $$insert into public.wallet_challenge (owner_user_id, nonce, expires_at)
    values ('f9999999-9999-4999-8999-999999999999', 'challenge-nonce-2', now() + interval '5 minutes')$$,
  '23503', null,
  'a challenge cannot point at a non-existent profile (owner FK)'
);

select throws_ok(
  $$insert into public.wallet_challenge (owner_user_id, nonce, expires_at)
    values (null, 'challenge-nonce-3', now() + interval '5 minutes')$$,
  '23502', null,
  'a challenge must have an owner'
);

reset role;

-- Deleting the profile is the Auth service's deletion path: it cascades the
-- challenge rows (on delete cascade). service_role has no DELETE on auth.users
-- (or profile), so the API role reads the resulting state below.
delete from auth.users where id = 'f1111111-1111-4111-8111-111111111111';

set local role service_role;

select is(
  (select count(*)::int from public.wallet_challenge
    where owner_user_id = 'f1111111-1111-4111-8111-111111111111'),
  0,
  'deleting the profile removes its challenges'
);

reset role;

select * from finish();

rollback;
