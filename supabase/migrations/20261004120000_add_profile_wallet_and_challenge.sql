-- PyME Freighter wallet connection: public key on the profile and a single-use
-- challenge table (Feature #406, Task #407 / T1a). This migration is the
-- database foundation only; the API endpoint that issues and verifies the
-- challenge, and the web Freighter client, land in later units.
--
-- The connection is trust-minimised: a PyME proves ownership of a Stellar
-- account by signing a single-use `nonce` challenge with Freighter, and the API
-- stores the resulting `G...` public key on the profile. The key becomes the
-- vault's immutable destination when an admin approves the campaign.
--
-- `public.profile.stellar_public_key` is nullable: a PyME has no key until it
-- completes the connection, and INVERSOR/ADMIN profiles never set one. The
-- CHECK accepts null or a Stellar ed25519 public key (`G` + 55 base32 chars).
--
-- `public.wallet_challenge` is service_role-only. RLS is enabled and the grants
-- are set explicitly in this same migration so no default anon/authenticated
-- grant ever survives even transiently, and there are ZERO policies on purpose:
-- the API connects as service_role (which bypasses RLS) and is the single
-- issuer/consumer of challenges. A challenge is single-use: `consumed_at` is
-- set when the signature is verified, and `expires_at` bounds how long an
-- unconsumed challenge stays valid.
--
-- Reversal (no data outside this feature depends on it):
--   drop table if exists public.wallet_challenge;
--   alter table public.profile drop column if exists stellar_public_key;

alter table public.profile
  add column stellar_public_key text,
  add constraint profile_stellar_public_key_check check (
    stellar_public_key is null
    or stellar_public_key ~ '^G[A-Z2-7]{55}$'
  );

create table public.wallet_challenge (
  challenge_id   uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references public.profile(user_id) on delete cascade,
  nonce          text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  consumed_at    timestamptz
);

-- Backs the owner foreign key (no scan on profile maintenance). No additional
-- indexes: challenges are looked up by primary key when consumed.
create index wallet_challenge_owner_user_id_idx on public.wallet_challenge (owner_user_id);

-- Access control: RLS on, grants explicit, no policies. service_role bypasses
-- RLS and is the API's role; it is the only reader/writer of challenges.
alter table public.wallet_challenge enable row level security;

revoke all on public.wallet_challenge from anon, authenticated, service_role;

grant select, insert, update, delete on public.wallet_challenge to service_role;
