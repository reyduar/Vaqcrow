-- One revenue-share distribution per campaign and period (Task #95 / T5a-F).
--
-- The API derives the period a distribution settles (the latest reported
-- `YYYY-MM` of the SME's sales feed). Persisting it lets the database refuse a
-- second non-failed distribution for the same (campaign, period), so the same
-- revenue cannot be paid to the investors twice even under a race between two
-- submissions. A failed distribution frees its slot, so a retry stays possible.
--
-- Empty-safe: the column is nullable and needs no backfill; rows recorded before
-- it existed keep a null period and fall outside the partial unique index.
--
-- Immutable after insert: the column-scoped UPDATE grant created in
-- `20260930124915_create_revenue_share_distribution.sql` lists only the state
-- machine columns, and this migration deliberately does not extend it.
--
-- Reversal:
--   drop index if exists public.revenue_share_distribution_campaign_period_key;
--   alter table public.revenue_share_distribution
--     drop constraint if exists revenue_share_distribution_period_format_check;
--   alter table public.revenue_share_distribution drop column if exists period;

alter table public.revenue_share_distribution
  add column if not exists period text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'revenue_share_distribution_period_format_check'
  ) then
    alter table public.revenue_share_distribution
      add constraint revenue_share_distribution_period_format_check
      check (period is null or period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  end if;
end
$$;

create unique index if not exists revenue_share_distribution_campaign_period_key
  on public.revenue_share_distribution (campaign_id, period)
  where state <> 'failed' and campaign_id is not null and period is not null;
