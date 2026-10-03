-- Private Storage bucket for PyME onboarding documents and photos
-- (Feature #398, Task #399 / T4a).
--
-- The bucket is private and holds the three mandatory document slots plus up to
-- four optional photos, all PDF/JPG/PNG up to 10 MB. Uploads are API-mediated:
-- the API validates the bytes and writes with the service role, so this
-- migration grants no write privilege through RLS beyond the owner's own path.
-- What it establishes is read/write isolation on `storage.objects`:
--   * an owner can only touch objects whose first path segment is their own
--     auth.uid() — path scheme `<user_id>/<kind>/<uuid>-<sanitized-name>` with
--     kind in (sales-declarations, cuit, articles-of-incorporation, photo);
--   * an ADMIN (public.profile.role = 'ADMIN') can read every object in the
--     bucket.
--
-- Storage-managed schema: `storage.buckets` and `storage.objects` are owned by
-- the Storage service. `storage.objects` already has RLS enabled and its grants
-- (`anon`/`authenticated` SELECT+INSERT+UPDATE+DELETE, Supabase-managed) are not
-- touched here. That is why this migration, unlike the `public` migrations,
-- carries no explicit REVOKE/GRANT — the discipline does not apply to a
-- Supabase-managed table. Only policies are added.
--
-- Reversal:
--   drop policy if exists pyme_documents_admin_read on storage.objects;
--   drop policy if exists pyme_documents_owner_delete on storage.objects;
--   drop policy if exists pyme_documents_owner_update on storage.objects;
--   drop policy if exists pyme_documents_owner_insert on storage.objects;
--   drop policy if exists pyme_documents_owner_read on storage.objects;
--   delete from storage.buckets where id = 'pyme-documents';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pyme-documents',
  'pyme-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner read: the first path segment is the caller's auth.uid().
create policy pyme_documents_owner_read on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pyme-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner insert: used only if an object is ever written with the owner's JWT.
create policy pyme_documents_owner_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pyme-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner update (upsert needs SELECT + INSERT + UPDATE; the SELECT policy above
-- supplies the missing half). USING and WITH CHECK both pin the owner so a row
-- cannot be reassigned to another path.
create policy pyme_documents_owner_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'pyme-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'pyme-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner delete.
create policy pyme_documents_owner_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pyme-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Admin read: any ADMIN profile may read every object in the bucket. The role
-- comes from `public.profile`, never from user-editable metadata.
create policy pyme_documents_admin_read on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pyme-documents'
    and exists (
      select 1
      from public.profile p
      where p.user_id = (select auth.uid())
        and p.role = 'ADMIN'
    )
  );
