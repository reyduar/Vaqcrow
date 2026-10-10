-- Expose Testnet transaction hashes to the role read models (Feature #438, WU3),
-- so the investor portfolio, the investor report and the PyME dashboard can
-- link each distribution and contribution to the explorer once the scripted
-- /evidence page is retired. The explorer URLs themselves are built by the API
-- from its own explorer base; no URL is stored.
--
-- 1. `transaction_hash` is APPENDED at the end of three existing views
--    (`create or replace view` may only add columns at the end; every existing
--    column keeps its name, type and position):
--      * investor_portfolio_distribution  (#426/WU1)
--      * investor_report_distribution     (#430/WU1)
--      * my_campaign_distribution         (#434/WU1; grouped by distribution,
--        so adding the distribution's own hash to the GROUP BY changes no row)
--    `revenue_share_distribution.transaction_hash` is `text not null unique`.
--
-- 2. A NEW view, `investor_contribution_transaction`: one row per **observed**
--    contribute transaction (`campaign_contribution_transaction`, #438/WU1, with
--    `observed_at IS NOT NULL` — a submitted but never confirmed transaction is
--    not evidence of a contribution), with the campaign's PyME name and vault
--    address. The API filters it by the account it resolves from the verified
--    principal, so an investor only ever reads its own hashes. Contributions
--    sent before WU1 have no row and stay "sin dato" — nothing is invented.
--    The company lateral is LEFT (a legacy campaign without a resolvable owner
--    still shows its transaction, with a NULL name) and mirrors the #426/#430
--    resolution: most recent `businesses` row of the application's owner.
--
-- `security_invoker = true` is re-stated on every view. Postgres keeps a view's
-- ACL across `create or replace view`, but the grants are re-stated anyway
-- (revoke from every role first, then SELECT to service_role only), so the
-- migration is self-evidently service_role-only like the views it amends.
--
-- Reversal:
--   drop view if exists public.investor_contribution_transaction;
--   A replace cannot remove a view column, so the three amended views are
--   reversed by dropping them and re-running their bodies and grants from
--   20261009120000 / 20261009130000 / 20261009140000.

create or replace view public.investor_portfolio_distribution
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
  d.created_at as recorded_at,
  d.transaction_hash
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

create or replace view public.investor_report_distribution
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
  sales.sales_ars as declared_sales_ars,
  d.transaction_hash
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

create or replace view public.my_campaign_distribution
with (security_invoker = true)
as
select
  sr.owner_user_id,
  d.campaign_id,
  d.distribution_id,
  d.period,
  d.state,
  pg_catalog.sum(r.amount_stroops) as amount_stroops,
  d.transaction_hash
from public.revenue_share_distribution as d
join public.campaign as c
  on c.campaign_id = d.campaign_id
join public.sme_request as sr
  on sr.application_id = c.application_id
join public.revenue_share_distribution_recipient as r
  on r.distribution_id = d.distribution_id
group by sr.owner_user_id, d.campaign_id, d.distribution_id, d.period, d.state, d.transaction_hash;

create view public.investor_contribution_transaction
with (security_invoker = true)
as
select
  cct.investor_account_id,
  cct.transaction_hash,
  cct.campaign_id,
  company.name as campaign_name,
  c.contract_address as vault_address,
  cct.amount_stroops,
  cct.observed_at
from public.campaign_contribution_transaction as cct
join public.campaign as c
  on c.campaign_id = cct.campaign_id
left join lateral (
  select b.name
    from public.businesses as b
    join public.sme_request as sr
      on sr.owner_user_id = b.owner_user_id
   where sr.application_id = c.application_id
   order by b.created_at desc, b.id
   limit 1
) as company on true
where cct.observed_at is not null;

revoke all on public.investor_portfolio_distribution from public, anon, authenticated, service_role;
revoke all on public.investor_report_distribution from public, anon, authenticated, service_role;
revoke all on public.my_campaign_distribution from public, anon, authenticated, service_role;
revoke all on public.investor_contribution_transaction from public, anon, authenticated, service_role;

grant select on public.investor_portfolio_distribution to service_role;
grant select on public.investor_report_distribution to service_role;
grant select on public.my_campaign_distribution to service_role;
grant select on public.investor_contribution_transaction to service_role;
