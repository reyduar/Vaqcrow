-- Snapshot the FX rate a campaign's terms were validated against (#410/T3a).
--
-- Decision D6 (`odd/tasks/application-review-and-vault-deployment.md`): a
-- campaign keeps the rate it was opened with, so a later change to the rate
-- table never moves the hard cap on a project already published. The three
-- columns are nullable because campaigns opened before this snapshot existed
-- carry none, and the table may already hold those rows — no backfill is
-- possible or wanted, and the snapshot is never required retroactively.
--
-- A campaign either keeps the whole snapshot or none of it; the check below
-- keeps a half-written one (e.g. a version without its values) out.
--
-- No FK to public.fx_rate on purpose: the snapshot is a copy of the values,
-- not a live reference, and campaign history must survive any pruning of the
-- rate table.
--
-- Reversal:
--   alter table public.campaign drop constraint if exists campaign_rate_snapshot_all_or_none;
--   alter table public.campaign drop column if exists fx_rate_version;
--   alter table public.campaign drop column if exists usd_to_ars;
--   alter table public.campaign drop column if exists stroops_per_usd;
--
-- No grant changes: the campaign table-level
-- `grant select, insert, update on public.campaign to service_role` already
-- covers every column, including these, and RLS stays exactly as configured
-- by the persistence migration (enabled, zero policies, service_role only).

alter table public.campaign
  add column if not exists fx_rate_version bigint,
  add column if not exists usd_to_ars bigint,
  add column if not exists stroops_per_usd bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_rate_snapshot_all_or_none'
  ) then
    alter table public.campaign
      add constraint campaign_rate_snapshot_all_or_none
      check (
        (fx_rate_version is null and usd_to_ars is null and stroops_per_usd is null)
        or (fx_rate_version is not null and usd_to_ars is not null and stroops_per_usd is not null)
      );
  end if;
end
$$;
