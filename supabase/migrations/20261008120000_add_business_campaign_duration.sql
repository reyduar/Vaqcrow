-- Persist the campaign duration the PyME chooses in the onboarding wizard
-- (Feature #410, work unit U13; owner decision 2026-10-08).
--
-- The PyME picks 30, 60 or 90 days in wizard step 2. The vault deadline is NOT
-- stored here: it is computed at deploy time as the moment of the deploy
-- attempt plus this duration, because the campaign becomes available on the
-- marketplace only when the admin approves and the vault confirms.
--
-- Nullable with no backfill: businesses registered before this column existed
-- carry none, and the deploy falls back to their persisted `deadline` (T5a).
--
-- Reversal:
--   alter table public.businesses drop constraint if exists businesses_campaign_duration_days_check;
--   alter table public.businesses drop column if exists campaign_duration_days;
--
-- No grant/RLS changes: the table-level
-- `grant select, insert, update on public.businesses to service_role` already
-- covers every column, including this one, and RLS stays exactly as configured
-- by the ownership migration (enabled, zero policies, service_role only).

alter table public.businesses
  add column if not exists campaign_duration_days smallint
    constraint businesses_campaign_duration_days_check
    check (campaign_duration_days in (30, 60, 90));
