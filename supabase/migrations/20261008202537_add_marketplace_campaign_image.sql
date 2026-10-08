-- Marketplace campaign image (Feature #414, work unit WU3).
--
-- The public marketplace card shows the PyME's **real** photo (owner decision
-- D2, 2026-10-08), served by the API from the private `pyme-documents` bucket.
-- This migration extends the WU1 `marketplace_campaign` view with the first
-- **photo** document of the campaign's PyME: the oldest by `created_at`, then
-- the smallest `id`, whose `kind = 'photo'` (the wizard's photo slot) and whose
-- stored content type is an image (`image/jpeg` / `image/png`). The API reads
-- those bytes through the shared `StoragePort`; the object path and content
-- type are exposed here only so the API can resolve them server-side, never to
-- a caller.
--
-- The `kind = 'photo'` predicate is load-bearing, not decorative: a required
-- document (cuit / articles-of-incorporation / sales-declarations) may legally
-- be uploaded with an image content type (`validateDocumentUpload` only checks
-- the bytes), so filtering on content type alone would publicly serve the
-- oldest required document — exactly what the private bucket exists to prevent.
--
-- The WU1 migration is already applied, so this is a `create or replace view`.
-- PostgreSQL only permits adding columns to the end of an existing view's
-- select list, so the two new columns (`image_object_path`, `image_content_type`)
-- are appended after the existing ones, in the same order and with the same
-- types. The company lateral now also selects `b.owner_user_id` so the image
-- lateral can join on it — that column is NOT part of the view's select list,
-- so the owner id never leaves the database.
--
-- Publication is unchanged: only a `confirmed` vault deployment on an `open`
-- campaign is published, and the image lateral hangs off that same row, so an
-- unpublished campaign (or a published one whose PyME has no image) exposes
-- NULL image columns and the API answers 404.
--
-- Replacing a view does not reliably preserve its access control, so the grants
-- are re-asserted here exactly as in WU1: `security_invoker = true` (Postgres
-- 15+) so the view honors each base table's RLS and grants, `revoke all` from
-- every role first (no default grant survives even transiently), then `select`
-- to `service_role` only. The API connects as service_role.
--
-- Reversal: this is a replacement, not a new object, so `drop view` would also
-- remove the WU1 view. To reverse, re-apply the WU1 definition
-- (20261008130000_create_marketplace_campaign_view.sql), which recreates the
-- view without the two image columns.

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
  c.stroops_per_usd,
  img.object_path  as image_object_path,
  img.content_type as image_content_type
from public.campaign as c
join public.campaign_deployment as cd
  on cd.application_id = c.application_id
 and cd.state = 'confirmed'
left join public.application_assessment as aa
  on aa.application_id = c.application_id
join lateral (
  select b.owner_user_id, b.name, b.sector, b.city, b.goal_ars, b.revenue_share
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
) as img on true
where c.state = 'open';

revoke all on public.marketplace_campaign from public, anon, authenticated, service_role;

grant select on public.marketplace_campaign to service_role;
