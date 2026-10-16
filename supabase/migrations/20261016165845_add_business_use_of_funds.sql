-- The PyME's declared use of funds ("Destino de los fondos", Feature #577).
--
-- Wizard step 2 now asks the PyME what the financing is for, as free text, and
-- the campaign detail, the PyME's "Ver lo enviado" panel and the admin review
-- show it. Until now the detail's "Destino de los fondos" section had no source
-- and always read "Sin dato".
--
-- `public.businesses.use_of_funds` is nullable `text` with no backfill:
-- businesses registered before this column existed carry none, and every
-- reader renders that NULL as the honest "sin dato". The web requires it on new
-- registrations; the API accepts it without requiring it, so an older web never
-- gets a 400 during a deploy. The named check caps it at 2000 characters, the
-- same limit the API enforces.
--
-- No grant/RLS changes on the table: the table-level
-- `grant select, insert, update on public.businesses to service_role` already
-- covers every column, including this one, and RLS stays exactly as configured
-- by the ownership migration (enabled, zero policies, service_role only).
--
-- `marketplace_campaign_detail` is replaced to append a single `use_of_funds`
-- column at the END, after `sales_months` (Postgres only allows appending
-- columns; every existing column keeps its name, type and order). The company
-- lateral now also selects `b.use_of_funds`. The view keeps
-- `security_invoker = true` and the `revoke all` + `grant select` to
-- `service_role`.
--
-- Reversal:
--   recreate public.marketplace_campaign_detail from 20261008230000 (without
--   `use_of_funds`), then:
--   alter table public.businesses drop constraint if exists businesses_use_of_funds_length_check;
--   alter table public.businesses drop column if exists use_of_funds;

alter table public.businesses
  add column if not exists use_of_funds text
    constraint businesses_use_of_funds_length_check
    check (use_of_funds is null or char_length(use_of_funds) <= 2000);

-- The `create or replace` repeats the whole view definition because Postgres has
-- no "add column"; the only change is the appended `use_of_funds`, plus the
-- company lateral selecting `b.use_of_funds`.
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
  sales.sales_months,
  company.use_of_funds
from public.campaign as c
join public.campaign_deployment as cd
  on cd.application_id = c.application_id
 and cd.state = 'confirmed'
left join public.application_assessment as aa
  on aa.application_id = c.application_id
join lateral (
  select b.id, b.owner_user_id, b.name, b.sector, b.city, b.description, b.created_at, b.goal_ars, b.revenue_share, b.use_of_funds
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
