-- Investor's simulated KYC (Feature #422, WU4).
--
-- The investor's identity verification is simulated and auto-approved at the
-- first contribution (owner decision D2): one row per investor, written by the
-- API on the first `POST /investor-kyc` and read on every `GET`. There is no
-- admin step and no rejection, so the table carries only existence, the approval
-- instant and the explicit `simulado` flag the demo labels on screen.
--
-- RLS is on with **zero policies** and grants only to `service_role`
-- (`select`/`insert`): the API reads and writes it with the service role, and no
-- `anon`/`authenticated` path exists. `revoke all` runs first so no default grant
-- survives even transiently, matching the repository's migration style. The
-- primary key makes the first-write path idempotent: a replay conflicts and the
-- adapter re-reads the existing row instead of inserting a duplicate.
--
-- Reversal:
--   drop table if exists public.investor_kyc;

create table public.investor_kyc (
  user_id     uuid primary key references public.profile (user_id) on delete cascade,
  approved_at timestamptz not null default now(),
  simulado    boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.investor_kyc enable row level security;

revoke all on public.investor_kyc from public, anon, authenticated, service_role;

grant select, insert on public.investor_kyc to service_role;
