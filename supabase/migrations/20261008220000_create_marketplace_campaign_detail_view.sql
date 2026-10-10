-- Account-gated campaign detail read model (Feature #422, work unit WU1).
--
-- The detail page renders a published campaign's full evidence: the company
-- facts, the mirrored funding progress, the AI risk assessment and the latest
-- human decision, plus the same real PyME photo the listing serves. Like
-- `marketplace_campaign`, the join is a server-side view: `campaign` and
-- `application_review` are keyed by `application_id`, but the company
-- (`businesses`) is linked to the request only through the owner
-- (`sme_request.owner_user_id = businesses.owner_user_id`), so PostgREST cannot
-- embed it.
--
-- Publication is the same row's own definition as the listing: only a
-- `confirmed` vault deployment on an `open` campaign is published. Both filters
-- live here, so the adapter cannot read an unpublished campaign by omission and
-- the API answers 404 for anything absent from this view.
--
-- The company lateral JOIN is INNER for the same reason as the listing: a
-- published campaign always resolved `businesses.goal_ars` at deploy time, and
-- the detail's name/sector/city/description/goal are required fields; a
-- published campaign whose company cannot be resolved is not a renderable
-- detail and must never be fabricated. At most one company is selected per
-- owner (the product registers one company per PyME), kept stable by the
-- deterministic order.
--
-- The AI assessment and the human decision are LEFT joins: a campaign without
-- one exposes NULLs, which the contract renders as the honest "sin dato", never
-- a zero. The decision is the **latest** recorded one (`decided_at desc`, then
-- `decision_id desc`); a published campaign was approved, so its outcome is not
-- exposed. The assessment's `reasons` are reduced to their claim strings here;
-- the evidence references stay in the database.
--
-- `backers` is the number of distinct mirrored contributors
-- (`campaign_contribution`), and `vault_address` is `campaign.contract_address`
-- — the vault contract id IS persisted on the campaign mirror (Feature #410),
-- so it can be exposed; it is a public Testnet contract address, never key
-- material. `fx_rate_version` / `usd_to_ars` / `stroops_per_usd` are exposed so
-- the API converts stroops to ARS with integer math and can render the honest
-- null when a campaign predates the snapshot.
--
-- The photo lateral reuses the exact #414/WU3 predicate: the first
-- `kind = 'photo'` document (oldest, then smallest id) whose stored content
-- type is an image, for the campaign's own company. The object path and content
-- type are exposed only so the API can proxy the bytes server-side; neither is
-- ever returned to a caller.
--
-- `security_invoker = true` (Postgres 15+) so the view runs with the querying
-- role's privileges and honors each base table's RLS and grants. The API
-- connects as service_role, which bypasses RLS; `SELECT` is granted only to
-- service_role (revoked from every other role first, so no default grant
-- survives even transiently), matching the repository's migration style.
--
-- Reversal:
--   drop view if exists public.marketplace_campaign_detail;

create view public.marketplace_campaign_detail
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
  c.stroops_per_usd
from public.campaign as c
join public.campaign_deployment as cd
  on cd.application_id = c.application_id
 and cd.state = 'confirmed'
left join public.application_assessment as aa
  on aa.application_id = c.application_id
join lateral (
  select b.owner_user_id, b.name, b.sector, b.city, b.description, b.created_at, b.goal_ars, b.revenue_share
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
where c.state = 'open';

revoke all on public.marketplace_campaign_detail from public, anon, authenticated, service_role;

grant select on public.marketplace_campaign_detail to service_role;
