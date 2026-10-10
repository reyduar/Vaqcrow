-- Persist the PyME's campaign deadline alongside the goal and revenue share it
-- already stores (Feature #410, Task #410 / T5a).
--
-- Decision D4 (`odd/tasks/application-review-and-vault-deployment.md`): the
-- PyME defines the terms of the project during registration, including the
-- deadline. The onboarding template (`Vaqcrow Onboarding PyME.dc.html`) does
-- not design a deadline field yet, so this column is backend-first and the
-- wizard field remains an open question — no UI is invented here.
--
-- Nullable with no backfill: businesses registered before this column existed
-- carry none, and a business may still be created without one while the wizard
-- does not send it.
--
-- Reversal:
--   alter table public.businesses drop column if exists deadline;
--
-- No grant/RLS changes: the table-level
-- `grant select, insert, update on public.businesses to service_role` already
-- covers every column, including this one, and RLS stays exactly as configured
-- by the ownership migration (enabled, zero policies, service_role only).

alter table public.businesses
  add column if not exists deadline timestamptz;
