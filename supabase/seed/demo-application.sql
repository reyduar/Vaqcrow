-- Demo bootstrap: the SME application the campaign-vault journey starts from.
--
-- WHY THIS FILE EXISTS
--
-- The web journey's approval step targets a frozen fixture id
-- (apps/web/src/application/fixtures/demo-application.ts). Nothing in the product creates the
-- matching `application_review` row: the `/request` form posts to a placeholder route, and
-- `ApplicationReviewRepositoryPort.create`/`transition` have no production call site. The local
-- profile papers over this by seeding the row with `docker exec` against the local Supabase
-- container (apps/web/e2e-live/support/db.ts) — an approach with no hosted equivalent.
--
-- This statement is that missing bootstrap step, in a form both profiles can run.
--
-- WHY `human_review`
--
-- The row is created in the state the product's own assessment flow would have produced, so the
-- human decision can be taken through the real interface and `record_human_decision` is exercised
-- as designed (it requires the row to exist in `human_review`). Seeding `approved` directly — the
-- local test suite's shortcut — would skip the step the demo is meant to show.
--
-- IDEMPOTENT
--
-- `on conflict do nothing` makes re-running safe: `applicationId` is frozen by the frontend, and
-- `campaign.application_id` is effectively 1:1 with a vault, so this row can only ever have one
-- campaign.
--
-- NO SECRETS. Contains only public, synthetic demo values.

insert into public.application_review (application_id, state, last_correlation_id)
values (
  '5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f',
  'human_review',
  '00000000-0000-4000-8000-000000000287'
)
on conflict (application_id) do nothing;
