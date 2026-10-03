-- Restrict PyME document writes to the API (Feature #398, Task #399 / T4b,
-- addressing review-8f8a47eea77a5f47 finding R1-001).
--
-- The upload transport is API-mediated: the browser sends bytes to the API,
-- which validates them (magic bytes, size, name) and writes to Storage with
-- `service_role`. `service_role` bypasses RLS, so the owner INSERT/UPDATE/DELETE
-- policies added by 20261003120000_create_pyme_documents_bucket.sql do not
-- protect that path — they only open a direct client write path that bypasses
-- the API's byte validation. This migration removes those three policies and
-- keeps only the two read policies:
--   * `pyme_documents_owner_read`  — an owner reads its own first path segment;
--   * `pyme_documents_admin_read`  — an ADMIN reads every object in the bucket.
--
-- New writes still reach Storage through `service_role` (which ignores RLS), and
-- reads keep working through the two remaining policies.
--
-- Apply-once: guarded with `drop policy if exists`, so re-applying is a no-op.
-- The bucket and the two read policies created by 20261003120000 remain.
--
-- Reversal: re-create the owner write policies exactly as they appear in
-- 20261003120000_create_pyme_documents_bucket.sql (owner_insert, owner_update,
-- owner_delete). Reversing the bucket migration requires purging
-- `storage.objects` through the Storage API, never SQL, because Storage installs
-- `protect_objects_delete` (BEFORE DELETE ... FOR EACH STATEMENT) which refuses
-- every direct DELETE.

drop policy if exists pyme_documents_owner_insert on storage.objects;
drop policy if exists pyme_documents_owner_update on storage.objects;
drop policy if exists pyme_documents_owner_delete on storage.objects;
