-- PyME "Mi campaña" dashboard read model (Feature #434, work unit WU1).
--
-- Three service_role-only views back `GET /my-campaigns`, which is PYME-only
-- and always scoped to the owner the API resolves from the verified principal
-- (`request.principal.userId`, never the request):
--
--   * `my_campaign_summary` — one row per campaign the PyME owns, with the
--     company's name/sector/city/goal, the campaign's state, progress, vault
--     address, deadline, the persisted FX snapshot and the contributor count.
--     `created_at` is exposed only so the API can order newest-first.
--
--   * `my_campaign_distribution` — one row per distribution the campaign paid
--     out, with its recipients' allocations summed. A distribution recorded
--     before the campaign link existed carries no campaign and is therefore not
--     part of a campaign's dashboard.
--
--   * `my_campaign_sales` — one row per declared-sales month of a campaign's
--     PyME, so the dashboard can show the campaign's sales history.
--
-- Owner resolution mirrors the #426/#430 views: the campaign reaches its owner
-- through its application's `sme_request.owner_user_id`, and the company is the
-- most recently created `businesses` row belonging to that owner (the FKs are
-- non-unique, so a PyME may own several businesses over time; a stable
-- `created_at desc, id` order keeps exactly one company per campaign). The
-- company lateral is INNER: the dashboard's name/sector/city/goal are required,
-- and a legacy campaign whose owner cannot be resolved simply does not appear
-- (never a crash). Ownerless legacy rows never match a principal and are
-- invisible by construction.
--
-- `security_invoker = true` (Postgres 15+) so the views run with the querying
-- role's privileges and honor each base table's RLS and grants. The API connects
-- as service_role, which bypasses RLS; `SELECT` is granted only to service_role
-- (revoked from every other role first, so no default grant survives even
-- transiently), matching the repository's migration style.
--
-- Reversal:
--   drop view if exists public.my_campaign_summary;
--   drop view if exists public.my_campaign_distribution;
--   drop view if exists public.my_campaign_sales;

create view public.my_campaign_summary
with (security_invoker = true)
as
select
  sr.owner_user_id,
  c.campaign_id,
  company.name,
  company.sector,
  company.city,
  company.goal_ars,
  c.total_stroops,
  c.goal_stroops,
  c.contract_address as vault_address,
  c.state,
  c.deadline,
  c.created_at,
  c.fx_rate_version,
  c.usd_to_ars,
  c.stroops_per_usd,
  (
    select pg_catalog.count(*)
      from public.campaign_contribution as cc
     where cc.campaign_id = c.campaign_id
  ) as contributors_count,
  img.object_path  as image_object_path,
  img.content_type as image_content_type
from public.campaign as c
join public.sme_request as sr
  on sr.application_id = c.application_id
join lateral (
  select b.id, b.owner_user_id, b.name, b.sector, b.city, b.goal_ars
    from public.businesses as b
   where b.owner_user_id = sr.owner_user_id
   order by b.created_at desc, b.id
   limit 1
) as company on true
left join lateral (
  select pd.object_path, pd.content_type
    from public.pyme_document as pd
   where pd.owner_user_id = company.owner_user_id
     and pd.kind = 'photo'
     and pd.content_type in ('image/jpeg', 'image/png')
   order by pd.created_at asc, pd.id asc
   limit 1
) as img on true;

create view public.my_campaign_distribution
with (security_invoker = true)
as
select
  sr.owner_user_id,
  d.campaign_id,
  d.distribution_id,
  d.period,
  d.state,
  pg_catalog.sum(r.amount_stroops) as amount_stroops
from public.revenue_share_distribution as d
join public.campaign as c
  on c.campaign_id = d.campaign_id
join public.sme_request as sr
  on sr.application_id = c.application_id
join public.revenue_share_distribution_recipient as r
  on r.distribution_id = d.distribution_id
group by sr.owner_user_id, d.campaign_id, d.distribution_id, d.period, d.state;

create view public.my_campaign_sales
with (security_invoker = true)
as
select
  sr.owner_user_id,
  c.campaign_id,
  bsp.period,
  bsp.sales_ars,
  bsp.status
from public.campaign as c
join public.sme_request as sr
  on sr.application_id = c.application_id
join lateral (
  select b.id, b.owner_user_id
    from public.businesses as b
   where b.owner_user_id = sr.owner_user_id
   order by b.created_at desc, b.id
   limit 1
) as company on true
join public.business_sales_period as bsp
  on bsp.business_id = company.id;

revoke all on public.my_campaign_summary from public, anon, authenticated, service_role;
revoke all on public.my_campaign_distribution from public, anon, authenticated, service_role;
revoke all on public.my_campaign_sales from public, anon, authenticated, service_role;

grant select on public.my_campaign_summary to service_role;
grant select on public.my_campaign_distribution to service_role;
grant select on public.my_campaign_sales to service_role;
