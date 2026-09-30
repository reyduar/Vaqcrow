-- Link a revenue-share distribution to the campaign it was derived from
-- (Task #95 / T5a).
--
-- The API now derives a distribution's recipients and amounts from one settled
-- campaign (its contributors, pro-rata by contribution), so the row records
-- which campaign that was. It is a traceability link, like `application_id`:
-- deleting the campaign must not delete the evidence of a signed instruction to
-- move money, hence ON DELETE SET NULL.
--
-- Empty-safe: the column is nullable and needs no backfill, so distributions
-- recorded before this link existed stay valid with a null campaign.
--
-- Immutable after insert: the column-scoped UPDATE grant created in
-- `20260930124915_create_revenue_share_distribution.sql` lists only the state
-- machine columns, and this migration deliberately does not extend it. The
-- table-level `revoke all` there guarantees no broader UPDATE survives, so the
-- service role can write `campaign_id` on insert and never rewrite it.
--
-- Reversal:
--   drop index if exists public.revenue_share_distribution_campaign_id_idx;
--   alter table public.revenue_share_distribution
--     drop constraint if exists revenue_share_distribution_campaign_id_fkey;
--   alter table public.revenue_share_distribution drop column if exists campaign_id;

alter table public.revenue_share_distribution
  add column if not exists campaign_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'revenue_share_distribution_campaign_id_fkey'
  ) then
    alter table public.revenue_share_distribution
      add constraint revenue_share_distribution_campaign_id_fkey
      foreign key (campaign_id)
      references public.campaign(campaign_id)
      on delete set null;
  end if;
end
$$;

-- Postgres does not index foreign keys automatically; the evidence read
-- correlates distributions by campaign.
create index if not exists revenue_share_distribution_campaign_id_idx
  on public.revenue_share_distribution (campaign_id);
