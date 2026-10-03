begin;

select plan(19);

-- Private PyME documents bucket and its storage.objects policies
-- (Feature #398, Task #399 / T4a).
--
-- The test owner (`postgres`) has BYPASSRLS, so fixtures are inserted directly
-- and then the policies are exercised under `set local role authenticated` with
-- a JWT `sub`, exactly as admin_rls_scope.sql and identity_and_audit.sql do.
--
-- Limitation: Storage installs `protect_objects_delete` (BEFORE DELETE ... FOR
-- EACH STATEMENT) on storage.objects, so no direct DELETE can run — the owner
-- DELETE policy is asserted to exist in `pg_policies` but is not exercised
-- through SQL. Reads, inserts and updates are exercised directly.

-- Bucket definition -----------------------------------------------------------

select is(
  (select public from storage.buckets where id = 'pyme-documents'),
  false,
  'the pyme-documents bucket exists and is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'pyme-documents'),
  10485760::bigint,
  'the bucket caps objects at 10 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'pyme-documents'),
  array['application/pdf', 'image/jpeg', 'image/png']::text[],
  'the bucket only allows PDF/JPEG/PNG'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'pyme_documents_owner_read'),
  1,
  'the owner read policy exists'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'pyme_documents_owner_insert'),
  1,
  'the owner insert policy exists'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'pyme_documents_owner_update'),
  1,
  'the owner update policy exists'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'pyme_documents_owner_delete'),
  1,
  'the owner delete policy exists'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'pyme_documents_admin_read'),
  1,
  'the admin read policy exists'
);

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('c1111111-1111-4111-8111-111111111111', 'doc-owner-a@example.test',
   '{"role": "PYME", "display_name": "Doc Owner A"}'::jsonb, '{}'::jsonb),
  ('c2222222-2222-4222-8222-222222222222', 'doc-owner-b@example.test',
   '{"role": "PYME", "display_name": "Doc Owner B"}'::jsonb, '{}'::jsonb),
  ('c3333333-3333-4333-8333-333333333333', 'doc-admin@example.test',
   '{"role": "INVERSOR"}'::jsonb,
   '{"role": "ADMIN", "display_name": "Doc Admin", "username": "fixture.pyme-documents.admin"}'::jsonb);

insert into storage.objects (id, bucket_id, name, owner)
values
  ('d1111111-1111-4111-8111-111111111111', 'pyme-documents',
   'c1111111-1111-4111-8111-111111111111/sales-declarations/aaaa-sales.pdf',
   'c1111111-1111-4111-8111-111111111111'),
  ('d2222222-2222-4222-8222-222222222222', 'pyme-documents',
   'c2222222-2222-4222-8222-222222222222/cuit/bbbb-cuit.pdf',
   'c2222222-2222-4222-8222-222222222222'),
  ('d3333333-3333-4333-8333-333333333333', 'pyme-documents',
   'c2222222-2222-4222-8222-222222222222/photo/cccc-photo.jpg',
   'c2222222-2222-4222-8222-222222222222');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'pyme-documents'),
  3,
  'three fixture objects exist before any policy is exercised'
);

-- Owner A: only its own first path segment ------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'c1111111-1111-4111-8111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'pyme-documents'),
  1,
  'owner A sees exactly one object'
);
select is(
  (select name from storage.objects where bucket_id = 'pyme-documents'),
  'c1111111-1111-4111-8111-111111111111/sales-declarations/aaaa-sales.pdf',
  'owner A sees only its own object'
);
select is(
  (select count(*)::int from storage.objects
    where split_part(name, '/', 1) = 'c2222222-2222-4222-8222-222222222222'),
  0,
  'owner A cannot read owner B''s object'
);

select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, owner)
    values ('d4444444-4444-4444-8444-444444444444', 'pyme-documents',
            'c1111111-1111-4111-8111-111111111111/cuit/eeee-cuit.pdf',
            'c1111111-1111-4111-8111-111111111111')$$,
  'owner A can insert under its own first path segment'
);
select throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner)
    values ('d5555555-5555-4555-8555-555555555555', 'pyme-documents',
            'c2222222-2222-4222-8222-222222222222/cuit/ffff-cuit.pdf',
            'c1111111-1111-4111-8111-111111111111')$$,
  '42501', null,
  'owner A cannot insert under another owner''s first path segment'
);

-- A data-modifying CTE must be at the top level of its statement, so the
-- UPDATE lives in the outer WITH and is() counts the rows it actually touched.
with denied as (
  update storage.objects set metadata = '{"tampered": true}'::jsonb
  where split_part(name, '/', 1) = 'c2222222-2222-4222-8222-222222222222'
  returning 1
)
select is(count(*)::int, 0, 'owner A cannot update owner B''s object') from denied;
-- The owner DELETE policy cannot be exercised here: Storage installs
-- `protect_objects_delete` (BEFORE DELETE ... FOR EACH STATEMENT) on
-- storage.objects, so every direct DELETE raises and only the Storage API may
-- delete. The policy's existence is asserted above; no direct-delete behavior
-- is claimed.

reset role;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'pyme-documents'),
  4,
  'the denied cross-owner writes left the other owner''s rows intact'
);

-- ADMIN: reads every object in the bucket, writes nothing ----------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'c3333333-3333-4333-8333-333333333333',
    'role', 'authenticated'
  )::text,
  true
);

select is(
  (select count(*)::int from storage.objects
    where split_part(name, '/', 1) = 'c2222222-2222-4222-8222-222222222222'),
  2,
  'an ADMIN can read another owner''s objects'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'pyme-documents'),
  4,
  'an ADMIN read policy reaches every object in the bucket'
);
with denied as (
  update storage.objects set metadata = '{"tampered": true}'::jsonb
  where split_part(name, '/', 1) = 'c2222222-2222-4222-8222-222222222222'
  returning 1
)
select is(count(*)::int, 0, 'the ADMIN read policy grants no write') from denied;

reset role;

select * from finish();

rollback;
