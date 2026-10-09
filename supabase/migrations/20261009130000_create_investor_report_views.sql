-- Investor report read model (Feature #430, work unit WU1).
--
-- Three service_role-only views back `GET /reports` and
-- `GET /reports/sales-by-pyme`, both available to every authenticated role and
-- always scoped to the account the API resolves from the verified principal:
--
--   * `investor_report_contribution` — one row per contribution the investor
--     made, with `observed_at = coalesce(last_observed_at, created_at)`. A
--     contribution is a cumulative per-account row with no per-event date, so
--     the report dates "aportado en el período" by that observed mark: an
--     explicit approximation, documented in the use case too.
--
--   * `investor_report_distribution` — one row per distribution recipient
--     addressed to the investor, with the persisted state, the confirmation time
--     and the PyME's declared sale for that distribution's period
--     (`business_sales_period`). `campaign_id`/`period` stay nullable for a
--     distribution recorded before those links existed.
--
--   * `investor_report_sales_by_pyme` — one row per declared-sales month of a
--     PyME the investor holds a position in, with the campaign id used to build
--     the API-relative image path. `distinct on` keeps exactly one campaign per
--     (investor, business, period) so a business reachable through more than one
--     campaign cannot duplicate the sales row.
--
-- The company lateral is INNER for the sales view (a declared-sales month only
-- exists for a resolved business) and LEFT for the distribution view (a legacy
-- distribution may name no campaign), selecting at most one company per owner
-- with a stable order. The company is resolved through the campaign's
-- application, exactly like the #426 portfolio views.
--
-- `security_invoker = true` (Postgres 15+) so the views run with the querying
-- role's privileges and honor each base table's RLS and grants. The API connects
-- as service_role, which bypasses RLS; `SELECT` is granted only to service_role
-- (revoked from every other role first, so no default grant survives even
-- transiently), matching the repository's migration style.
--
-- Reversal:
--   drop view if exists public.investor_report_contribution;
--   drop view if exists public.investor_report_distribution;
--   drop view if exists public.investor_report_sales_by_pyme;

create view public.investor_report_contribution
with (security_invoker = true)
as
select
  cc.investor_account_id,
  cc.campaign_id,
  cc.amount_stroops as contribution_stroops,
  coalesce(cc.last_observed_at, cc.created_at) as observed_at
from public.campaign_contribution as cc;

create view public.investor_report_distribution
with (security_invoker = true)
as
select
  r.account_id as investor_account_id,
  d.distribution_id,
  d.campaign_id,
  company.name as campaign_name,
  d.period,
  r.amount_stroops,
  d.state,
  d.confirmed_at,
  d.created_at as recorded_at,
  sales.sales_ars as declared_sales_ars
from public.revenue_share_distribution_recipient as r
join public.revenue_share_distribution as d
  on d.distribution_id = r.distribution_id
left join public.campaign as c
  on c.campaign_id = d.campaign_id
left join lateral (
  select b.id, b.name
    from public.businesses as b
    join public.sme_request as sr
      on sr.owner_user_id = b.owner_user_id
   where sr.application_id = c.application_id
   order by b.created_at desc, b.id
   limit 1
) as company on true
left join lateral (
  select bsp.sales_ars
    from public.business_sales_period as bsp
   where bsp.business_id = company.id
     and bsp.period = d.period
   limit 1
) as sales on true;

create view public.investor_report_sales_by_pyme
with (security_invoker = true)
as
select distinct on (cc.investor_account_id, company.id, bsp.period)
  cc.investor_account_id,
  c.campaign_id,
  company.name,
  company.sector,
  bsp.period,
  bsp.sales_ars,
  bsp.status
from public.campaign_contribution as cc
join public.campaign as c
  on c.campaign_id = cc.campaign_id
join lateral (
  select b.id, b.name, b.sector
    from public.businesses as b
    join public.sme_request as sr
      on sr.owner_user_id = b.owner_user_id
   where sr.application_id = c.application_id
   order by b.created_at desc, b.id
   limit 1
) as company on true
join public.business_sales_period as bsp
  on bsp.business_id = company.id
order by cc.investor_account_id, company.id, bsp.period, c.created_at desc, c.campaign_id;

revoke all on public.investor_report_contribution from public, anon, authenticated, service_role;
revoke all on public.investor_report_distribution from public, anon, authenticated, service_role;
revoke all on public.investor_report_sales_by_pyme from public, anon, authenticated, service_role;

grant select on public.investor_report_contribution to service_role;
grant select on public.investor_report_distribution to service_role;
grant select on public.investor_report_sales_by_pyme to service_role;
