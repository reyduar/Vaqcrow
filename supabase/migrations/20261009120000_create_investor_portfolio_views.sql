-- Investor portfolio read model (Feature #426, work unit WU1).
--
-- Two service_role-only views back `GET /portfolio`, which is INVERSOR-only and
-- always scoped to the account the API resolves from the verified principal:
--
--   * `investor_portfolio_position` — one row per contribution the investor made
--     to a **deployed** campaign (a `confirmed` vault deployment). Unlike the
--     marketplace/detail views it deliberately does NOT filter `campaign.state
--     = 'open'`: the investor's own positions include settled and refundable
--     campaigns, and excluding them would hide money the investor is owed or
--     can refund. A contribution only exists on a deployed campaign, so the
--     deployment join is required.
--
--   * `investor_portfolio_distribution` — one row per distribution recipient
--     addressed to the investor, with the persisted distribution state so the
--     API can sum only confirmed amounts. `campaign_id`/`period` stay nullable
--     for a distribution recorded before those links existed.
--
-- The company lateral JOIN is INNER for the position view (a deployed campaign
-- always resolved `businesses.goal_ars`, and the card's name/sector/city/goal
-- are required) and LEFT for the distribution view (a legacy distribution may
-- name no campaign), both selecting at most one company per owner with a stable
-- order. The photo lateral reuses the exact #414/WU3 predicate: the first
-- `kind = 'photo'` document whose stored content type is an image; the object
-- path and content type are exposed only so the API can proxy the bytes
-- server-side, and neither is ever returned to a caller.
--
-- `security_invoker = true` (Postgres 15+) so the views run with the querying
-- role's privileges and honor each base table's RLS and grants. The API
-- connects as service_role, which bypasses RLS; `SELECT` is granted only to
-- service_role (revoked from every other role first, so no default grant
-- survives even transiently), matching the repository's migration style.
--
-- Reversal:
--   drop view if exists public.investor_portfolio_position;
--   drop view if exists public.investor_portfolio_distribution;

create view public.investor_portfolio_position
with (security_invoker = true)
as
select
  cc.investor_account_id,
  c.campaign_id,
  company.name,
  company.sector,
  company.city,
  company.goal_ars,
  c.total_stroops,
  c.goal_stroops,
  c.deadline,
  c.state,
  c.contract_address,
  cc.amount_stroops as contribution_stroops,
  c.fx_rate_version,
  c.usd_to_ars,
  c.stroops_per_usd,
  img.object_path  as image_object_path,
  img.content_type as image_content_type
from public.campaign_contribution as cc
join public.campaign as c
  on c.campaign_id = cc.campaign_id
join public.campaign_deployment as cd
  on cd.application_id = c.application_id
 and cd.state = 'confirmed'
join lateral (
  select b.owner_user_id, b.name, b.sector, b.city, b.goal_ars
    from public.businesses as b
    join public.sme_request as sr
      on sr.owner_user_id = b.owner_user_id
   where sr.application_id = c.application_id
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

create view public.investor_portfolio_distribution
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
  d.created_at as recorded_at
from public.revenue_share_distribution_recipient as r
join public.revenue_share_distribution as d
  on d.distribution_id = r.distribution_id
left join public.campaign as c
  on c.campaign_id = d.campaign_id
left join lateral (
  select b.name
    from public.businesses as b
    join public.sme_request as sr
      on sr.owner_user_id = b.owner_user_id
   where sr.application_id = c.application_id
   order by b.created_at desc, b.id
   limit 1
) as company on true;

revoke all on public.investor_portfolio_position from public, anon, authenticated, service_role;
revoke all on public.investor_portfolio_distribution from public, anon, authenticated, service_role;

grant select on public.investor_portfolio_position to service_role;
grant select on public.investor_portfolio_distribution to service_role;
