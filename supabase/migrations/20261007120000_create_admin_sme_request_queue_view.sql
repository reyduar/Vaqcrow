-- Admin PyMEs queue read model (Feature #386, Task #386 / T1).
--
-- The console's queue lists every submitted application with its company name,
-- sector, review state and last change. `application_review` and `sme_request`
-- are keyed by `application_id`; the company (`businesses`) is linked to the
-- request only through the owner (`sme_request.owner_user_id = profile.user_id`
-- and `businesses.owner_user_id = profile.user_id`). There is no direct foreign
-- key between `sme_request` and `businesses`, so PostgREST cannot embed or order
-- by it — this view is the server-side join the ADMIN listing reads.
--
-- The join is a LEFT JOIN so an application whose owner has no `businesses` row
-- still appears: the API renders the honest "Sin dato" for a missing company
-- instead of dropping the row or inventing a name.
--
-- At most one company is selected per owner (the product registers one company
-- per PyME); the deterministic `order by ... limit 1` keeps the view stable even
-- if a legacy row ever added a second one, and never multiplies applications.
--
-- `security_invoker = true` (Postgres 15+) so the view runs with the querying
-- role's privileges and honors each base table's RLS and grants. The API
-- connects as service_role, which bypasses RLS; `SELECT` is granted only to
-- service_role (revoked from every other role first, so no default grant
-- survives even transiently), matching the repository's migration style.
--
-- Reversal:
--   drop view if exists public.admin_sme_request_queue;

create or replace view public.admin_sme_request_queue
with (security_invoker = true)
as
select
  sr.application_id::text as application_id,
  company.name            as name,
  company.sector          as sector,
  ar.state                as state,
  ar.updated_at           as updated_at
from public.sme_request as sr
join public.application_review as ar
  on ar.application_id = sr.application_id
left join lateral (
  select b.name, b.sector
    from public.businesses as b
   where b.owner_user_id = sr.owner_user_id
   order by b.created_at desc, b.id
   limit 1
) as company on true;

revoke all on public.admin_sme_request_queue from anon, authenticated, service_role;

grant select on public.admin_sme_request_queue to service_role;
