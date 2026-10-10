-- Persisted monthly sales series for the campaign detail (Feature #422, WU2b).
--
-- The "Evidencia de ventas" section of the campaign detail needs the PyME's
-- monthly sales to be real (persisted, `SIMULADO`) data. Today the monthly
-- series is served by an in-memory deterministic provider (`GET
-- /businesses/:businessId/sales-periods`); this migration gives it a durable
-- home so the account-gated detail can read it, while the sales feed keeps
-- serving the same values.
--
-- `public.business_sales_period` is one row per `(business_id, period)`:
--   * `sales_ars` is `bigint` and `null` for a `missing` month — never a `0`
--     (a missing declaration is an absence, not a zero). The check ties the
--     null to `status = 'missing'` in both directions, so the two can never
--     disagree.
--   * `source` mirrors the feed's per-datum provenance; every row is synthetic
--     and carries the `SIMULADO` label through that source string.
--   * the primary key makes the writer's `upsert` idempotent, so persisting a
--     business's series (at creation and in the manual backfill) never
--     duplicates or advances it.
--
-- RLS is on with **zero policies** and grants only to `service_role`
-- (`select`/`insert`/`update`, no `delete`): the API writes and reads it with
-- the service role, and no `anon`/`authenticated` path exists. `revoke all`
-- runs first so no default grant survives even transiently, matching the
-- repository's migration style.
--
-- `marketplace_campaign_detail` is replaced to append a single `sales_months`
-- JSONB column at the END (Postgres only allows appending columns; every
-- existing column keeps its name, type and order). It aggregates the company's
-- rows ordered by `period`; a company with no persisted periods exposes `NULL`,
-- which the API renders as the honest "sin dato". The view keeps
-- `security_invoker = true` and the `revoke all` + `grant select` to
-- `service_role`.
--
-- Reversal:
--   recreate public.marketplace_campaign_detail from 20261008220000 (without
--   `sales_months`), then:
--   drop table if exists public.business_sales_period;

create table public.business_sales_period (
  business_id uuid not null references public.businesses (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  sales_ars bigint null check (sales_ars is null or sales_ars >= 0),
  status text not null check (status in ('reported', 'missing', 'anomalous')),
  source text not null,
  created_at timestamptz not null default now(),
  primary key (business_id, period),
  -- A `missing` month is exactly the one without an amount: an absence, never 0.
  constraint business_sales_period_missing_is_null check ((sales_ars is null) = (status = 'missing'))
);

alter table public.business_sales_period enable row level security;

revoke all on public.business_sales_period from public, anon, authenticated, service_role;

grant select, insert, update on public.business_sales_period to service_role;

-- The `create or replace` repeats the whole view definition because Postgres has
-- no "add column"; the only change is the appended `sales_months`, plus the
-- company lateral now selecting `b.id` so the sales lateral can join on it.
create or replace view public.marketplace_campaign_detail
with (security_invoker = true)
as
select
  c.campaign_id,
  company.name,
  company.sector,
  company.city,
  company.description,
  company.created_at as founded_at,
  company.goal_ars,
  c.total_stroops,
  c.goal_stroops,
  company.revenue_share,
  c.deadline,
  c.state,
  c.contract_address as vault_address,
  (
    select pg_catalog.count(*)
      from public.campaign_contribution as cc
     where cc.campaign_id = c.campaign_id
  ) as backers,
  (aa.application_id is not null) as assessment_present,
  aa.assessment ->> 'riskBand'   as assessment_risk_band,
  aa.assessment ->> 'confidence' as assessment_confidence,
  (
    select pg_catalog.jsonb_agg(reason ->> 'claim' order by ordinal)
      from pg_catalog.jsonb_array_elements(aa.assessment -> 'reasons')
        with ordinality as elements(reason, ordinal)
  ) as assessment_reasons,
  aa.metadata ->> 'model' as assessment_model,
  (aa.metadata ->> 'generatedAt')::timestamptz as assessment_generated_at,
  latest_decision.actor        as decision_actor,
  latest_decision.reason       as decision_reason,
  latest_decision.approved_limit_ars as decision_approved_limit_ars,
  latest_decision.decided_at   as decision_recorded_at,
  img.object_path  as image_object_path,
  img.content_type as image_content_type,
  c.fx_rate_version,
  c.usd_to_ars,
  c.stroops_per_usd,
  sales.sales_months
from public.campaign as c
join public.campaign_deployment as cd
  on cd.application_id = c.application_id
 and cd.state = 'confirmed'
left join public.application_assessment as aa
  on aa.application_id = c.application_id
join lateral (
  select b.id, b.owner_user_id, b.name, b.sector, b.city, b.description, b.created_at, b.goal_ars, b.revenue_share
    from public.businesses as b
    join public.sme_request as sr
      on sr.owner_user_id = b.owner_user_id
   where sr.application_id = c.application_id
   order by b.created_at desc, b.id
   limit 1
) as company on true
left join lateral (
  select hd.actor, hd.reason, hd.approved_limit_ars, hd.decided_at
    from public.human_decision as hd
   where hd.application_id = c.application_id
   order by hd.decided_at desc, hd.decision_id desc
   limit 1
) as latest_decision on true
left join lateral (
  select pd.object_path, pd.content_type
    from public.pyme_document as pd
   where pd.owner_user_id = company.owner_user_id
     and pd.kind = 'photo'
     and pd.content_type in ('image/jpeg', 'image/png')
   order by pd.created_at asc, pd.id asc
   limit 1
) as img on true
left join lateral (
  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'period', bsp.period,
      'sales_ars', bsp.sales_ars,
      'status', bsp.status,
      'source', bsp.source
    ) order by bsp.period
  ) as sales_months
    from public.business_sales_period as bsp
   where bsp.business_id = company.id
) as sales on true
where c.state = 'open';

revoke all on public.marketplace_campaign_detail from public, anon, authenticated, service_role;

grant select on public.marketplace_campaign_detail to service_role;
