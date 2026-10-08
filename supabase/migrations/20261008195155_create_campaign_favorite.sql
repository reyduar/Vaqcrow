-- Per-account campaign favorites (Feature #414, work unit WU2).
--
-- `public.campaign_favorite` is one row per (user, campaign) a signed-in user
-- saved. Owner decision D1 (2026-10-08): favorites persist per account, so the
-- marketplace listing itself stays public and cacheable and this table is only
-- read and written when the user is signed in. Anonymous visitors retain
-- nothing.
--
-- The API is the only writer and connects as `service_role`: it resolves the
-- owner from the verified principal and scopes every query by `user_id`, so
-- `authenticated`/`anon` hold no grant at all — there is no client read or
-- write path. RLS is enabled with zero policies (defense in depth on an exposed
-- schema): `service_role` bypasses RLS, and no other role can reach the table.
--
-- `(user_id, campaign_id)` is the primary key, so it is also the unique key that
-- makes `add` idempotent (a `23505` means "already favorited") and the index that
-- serves the per-user listing. `campaign_id` references `public.campaign` with
-- `on delete cascade`: a favorite cannot outlive its campaign. The separate
-- `campaign_id` index keeps that cascade a targeted lookup instead of a
-- sequential scan of every favorite.
--
-- Migration workflow: authored and verified against the local stack first
-- (`supabase migration up --local`, then `pnpm run test:db`), and only applied to
-- the remote Supabase project afterwards, in the same work unit, once the local
-- suite is green.
--
-- Reversal (no data outside this feature depends on it):
--   drop table if exists public.campaign_favorite;

create table public.campaign_favorite (
  user_id     uuid not null,
  campaign_id uuid not null references public.campaign(campaign_id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, campaign_id)
);

-- The FK's referencing side is indexed so a campaign delete cascades without a
-- sequential scan of campaign_favorite.
create index campaign_favorite_campaign_id_idx on public.campaign_favorite (campaign_id);

-- Access control: RLS on, grants explicit in this same migration so no default
-- anon/authenticated grant ever survives even transiently. Writes and reads are
-- service_role-only; the API scopes them by the verified principal's user_id.
alter table public.campaign_favorite enable row level security;

revoke all on public.campaign_favorite from public, anon, authenticated, service_role;

-- Read a user's favorites, add one, and remove one (unfavorite is a delete).
-- No UPDATE path exists: a favorite is immutable until it is removed.
grant select, insert, delete on public.campaign_favorite to service_role;
