-- PyME company model and per-row ownership (Feature #398, Task #399 / T3a,
-- owner decision 5 = option A). This migration is the database foundation for
-- resolving R1-002: the API routes checked the role but not that the row belongs
-- to the caller. The API-side scoping lands in T3b; here we add the table and
-- the owner columns it scopes on.
--
-- `public.businesses` is service_role-only. RLS is enabled and the grants are
-- set explicitly in this same migration so no default anon/authenticated grant
-- ever survives even transiently, and there are ZERO policies on purpose: the
-- API connects as service_role (which bypasses RLS) and is the single ownership
-- enforcement point — a request may only touch a row whose `owner_user_id`
-- matches the authenticated principal. No client role gets a path at all.
--
-- `public.sme_request` already existed as a service_role-only table
-- (select + insert; no update/delete — a submitted request is immutable). Adding
-- a nullable `owner_user_id` column does not change the table-level grants, so
-- no REVOKE/GRANT is issued for it here.
--
-- Reversal (no data outside this feature depends on it):
--   drop index if exists public.sme_request_owner_user_id_idx;
--   alter table public.sme_request drop column if exists owner_user_id;
--   drop table if exists public.businesses;
create table public.businesses (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references public.profile(user_id) on delete cascade,
  name           text not null,
  cuit           text not null,
  sector         text not null,
  city           text not null,
  description    text not null,
  goal_ars       bigint not null,
  revenue_share  numeric not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Mirrors the wizard's validation; the CUIT is checked as 11 digits only
  -- (no AFIP/ARCA lookup).
  constraint businesses_cuit_check check (cuit ~ '^[0-9]{11}$'),
  constraint businesses_goal_ars_check check (goal_ars > 0),
  constraint businesses_revenue_share_check check (revenue_share between 1 and 10)
);

-- Backs the owner foreign key (no scan on profile maintenance) and the
-- owner-scoped reads the API will issue.
create index businesses_owner_user_id_idx on public.businesses (owner_user_id);

-- Access control: RLS on, grants explicit, no policies. service_role bypasses
-- RLS and is the API's role; it may read, create and update companies but never
-- delete them.
alter table public.businesses enable row level security;

revoke all on public.businesses from anon, authenticated, service_role;

grant select, insert, update on public.businesses to service_role;

-- Ownership for the financing request the wizard submits. Nullable because
-- pre-existing demo rows predate ownership; new inserts set it. `set null`
-- (not cascade) keeps the request row — and its application/audit trail — even
-- if the profile is ever removed.
alter table public.sme_request
  add column owner_user_id uuid references public.profile(user_id) on delete set null;

-- Backs the FK and the owner-scoped request reads (R1-002).
create index sme_request_owner_user_id_idx on public.sme_request (owner_user_id);
