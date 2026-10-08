-- Public marketplace campaign read model (Feature #414, work unit WU1).
--
-- The investor marketplace lists published campaigns with the card facts the
-- template renders: company name, sector, city, goal (ARS), revenue share,
-- the mirrored raised total and deadline, the AI risk band/confidence, and the
-- campaign's FX rate snapshot so the API can convert stroops to ARS with
-- integer math.
--
-- The join is a server-side view, the same choice as
-- `admin_sme_request_queue`: `campaign` and `application_review` are keyed by
-- `application_id`, but the company (`businesses`) is linked to the request only
-- through the owner (`sme_request.owner_user_id = businesses.owner_user_id`).
-- There is no foreign key between them, so PostgREST cannot embed the company.
--
-- Publication is the row's own definition: only a `confirmed` vault deployment
-- on an `open` campaign is a published campaign, so both filters live here —
-- the adapter cannot list an unpublished campaign by omission. The published
-- vault is joined to its campaign by `application_id` (the deployment's primary
-- key).
--
-- The company lateral JOIN is INNER on purpose: publishing already required a
-- registered company (the deploy resolves `businesses.goal_ars` to build the
-- vault), and the card's name/sector/city/goal are required fields — a
-- published campaign whose company cannot be resolved is not a renderable card,
-- and the listing must never fabricate one. At most one company is selected per
-- owner (the product registers one company per PyME); the deterministic
-- `order by ... limit 1` keeps it stable even if a legacy second row existed.
--
-- The risk band and confidence come from the application's persisted AI
-- assessment; when there is none (or it was routed to human review), both are
-- NULL, which the contract renders as the honest "sin dato", never a zero.
--
-- `security_invoker = true` (Postgres 15+) so the view runs with the querying
-- role's privileges and honors each base table's RLS and grants. The API
-- connects as service_role, which bypasses RLS; `SELECT` is granted only to
-- service_role (revoked from every other role first, so no default grant
-- survives even transiently), matching the repository's migration style.
--
-- Reversal:
--   drop view if exists public.marketplace_campaign;

create or replace view public.marketplace_campaign
with (security_invoker = true)
as
select
  c.campaign_id,
  company.name,
  company.sector,
  company.city,
  company.goal_ars,
  company.revenue_share,
  c.total_stroops,
  c.goal_stroops,
  c.deadline,
  aa.assessment ->> 'riskBand'   as risk_band,
  aa.assessment ->> 'confidence' as risk_confidence,
  c.fx_rate_version,
  c.usd_to_ars,
  c.stroops_per_usd
from public.campaign as c
join public.campaign_deployment as cd
  on cd.application_id = c.application_id
 and cd.state = 'confirmed'
left join public.application_assessment as aa
  on aa.application_id = c.application_id
join lateral (
  select b.name, b.sector, b.city, b.goal_ars, b.revenue_share
    from public.businesses as b
    join public.sme_request as sr
      on sr.owner_user_id = b.owner_user_id
   where sr.application_id = c.application_id
   order by b.created_at desc, b.id
   limit 1
) as company on true
where c.state = 'open';

revoke all on public.marketplace_campaign from anon, authenticated, service_role;

grant select on public.marketplace_campaign to service_role;
