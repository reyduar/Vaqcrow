begin;

select plan(49);

-- Persisted PyME documents (content-relevance/vision feature, unit U1).
--
-- `public.pyme_document` is one row per upload: the API validates the bytes,
-- writes the object to the private `pyme-documents` bucket, and records the row
-- here with `service_role`. It is service_role-only — RLS is enabled with ZERO
-- policies and the grants are set explicitly in the same migration, so no
-- default anon/authenticated grant ever survives. `service_role` may read,
-- insert and delete (the upload and its deletion) but never update: a document
-- descriptor is immutable once stored.
--
-- `object_path` is the unique identity the Storage API and the delete route use;
-- `kind` is constrained to the four slots the wizard uploads.

-- Structure -------------------------------------------------------------------

select has_table('public', 'pyme_document', 'pyme_document table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.pyme_document'::regclass),
  true,
  'pyme_document has row-level security enabled'
);

select has_column('public', 'pyme_document', 'id', 'pyme_document has an id column');
select has_column('public', 'pyme_document', 'owner_user_id', 'pyme_document has an owner_user_id column');
select has_column('public', 'pyme_document', 'kind', 'pyme_document has a kind column');
select has_column('public', 'pyme_document', 'object_path', 'pyme_document has an object_path column');
select has_column('public', 'pyme_document', 'name', 'pyme_document has a name column');
select has_column('public', 'pyme_document', 'size_bytes', 'pyme_document has a size_bytes column');
select has_column('public', 'pyme_document', 'content_type', 'pyme_document has a content_type column');
select has_column('public', 'pyme_document', 'created_at', 'pyme_document has a created_at column');

select col_type_is('public', 'pyme_document', 'id', 'uuid', 'id is a uuid');
select col_type_is('public', 'pyme_document', 'owner_user_id', 'uuid', 'owner_user_id is a uuid');
select col_type_is('public', 'pyme_document', 'kind', 'text', 'kind is text');
select col_type_is('public', 'pyme_document', 'object_path', 'text', 'object_path is text');
select col_type_is('public', 'pyme_document', 'name', 'text', 'name is text');
select col_type_is('public', 'pyme_document', 'size_bytes', 'bigint', 'size_bytes is a bigint');
select col_type_is('public', 'pyme_document', 'content_type', 'text', 'content_type is text');
select col_type_is('public', 'pyme_document', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');

select col_not_null('public', 'pyme_document', 'owner_user_id', 'a document always has an owner');
select col_not_null('public', 'pyme_document', 'kind', 'a document always has a kind');
select col_not_null('public', 'pyme_document', 'object_path', 'a document always has an object path');
select col_not_null('public', 'pyme_document', 'name', 'a document always has a name');
select col_not_null('public', 'pyme_document', 'size_bytes', 'a document always has a size');
select col_not_null('public', 'pyme_document', 'content_type', 'a document always has a content type');
select col_not_null('public', 'pyme_document', 'created_at', 'a document is always timestamped');

select col_has_default('public', 'pyme_document', 'id', 'id generates its own uuid');
select col_has_default('public', 'pyme_document', 'created_at', 'created_at defaults to now()');

select fk_ok(
  'public', 'pyme_document', 'owner_user_id',
  'public', 'profile', 'user_id',
  'pyme_document.owner_user_id references profile.user_id'
);

select has_index(
  'public', 'pyme_document', 'pyme_document_owner_user_id_idx',
  'the owner-scoped listing index exists'
);
select col_is_unique(
  'public', 'pyme_document', 'object_path',
  'object_path is unique: one row per stored object'
);

-- Access control: RLS on, grants explicit, no policies ------------------------

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pyme_document'),
  0,
  'pyme_document has no policies: the API (service_role) is the single enforcement point'
);

select is(has_table_privilege('anon', 'public.pyme_document', 'select'), false, 'anon cannot read pyme_document');
select is(has_table_privilege('anon', 'public.pyme_document', 'insert'), false, 'anon cannot insert pyme_document');
select is(has_table_privilege('anon', 'public.pyme_document', 'update'), false, 'anon cannot update pyme_document');
select is(has_table_privilege('anon', 'public.pyme_document', 'delete'), false, 'anon cannot delete pyme_document');
select is(has_table_privilege('authenticated', 'public.pyme_document', 'select'), false, 'authenticated cannot read pyme_document');
select is(has_table_privilege('authenticated', 'public.pyme_document', 'insert'), false, 'authenticated cannot insert pyme_document');
select is(has_table_privilege('authenticated', 'public.pyme_document', 'update'), false, 'authenticated cannot update pyme_document');
select is(has_table_privilege('authenticated', 'public.pyme_document', 'delete'), false, 'authenticated cannot delete pyme_document');
select is(has_table_privilege('service_role', 'public.pyme_document', 'select'), true, 'service role can read pyme_document');
select is(has_table_privilege('service_role', 'public.pyme_document', 'insert'), true, 'service role can insert pyme_document');
select is(has_table_privilege('service_role', 'public.pyme_document', 'update'), false, 'service role cannot update a stored document');
select is(has_table_privilege('service_role', 'public.pyme_document', 'delete'), true, 'service role can delete pyme_document');

-- Behavior --------------------------------------------------------------------
-- Exercised as service_role, the role the API connects as, so the write grants
-- the migration actually keeps are the ones under test.

-- A profile is created by the auth.users signup trigger, so the FK is exercised
-- against a real public.profile row.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'f1111111-1111-4111-8111-111111111111', 'doc-owner@example.test',
  '{"role": "PYME", "display_name": "Doc Owner"}'::jsonb, '{}'::jsonb
);

set local role service_role;

insert into public.pyme_document (
  owner_user_id, kind, object_path, name, size_bytes, content_type
) values (
  'f1111111-1111-4111-8111-111111111111', 'cuit',
  'f1111111-1111-4111-8111-111111111111/cuit/aaaa-cuit.pdf',
  'cuit.pdf', 1234, 'application/pdf'
);

select is(
  (select count(*)::int from public.pyme_document
    where owner_user_id = 'f1111111-1111-4111-8111-111111111111'),
  1,
  'a valid document is stored for its owner'
);

select throws_ok(
  $$insert into public.pyme_document (
      owner_user_id, kind, object_path, name, size_bytes, content_type
    ) values (
      'f1111111-1111-4111-8111-111111111111', 'passport',
      'f1111111-1111-4111-8111-111111111111/passport/bbbb.pdf',
      'passport.pdf', 10, 'application/pdf'
    )$$,
  '23514', null,
  'an unknown kind is rejected by the check'
);

select throws_ok(
  $$insert into public.pyme_document (
      owner_user_id, kind, object_path, name, size_bytes, content_type
    ) values (
      'f1111111-1111-4111-8111-111111111111', 'cuit',
      'f1111111-1111-4111-8111-111111111111/cuit/aaaa-cuit.pdf',
      'otro.pdf', 10, 'application/pdf'
    )$$,
  '23505', null,
  'the same object_path cannot be stored twice'
);

select throws_ok(
  $$insert into public.pyme_document (
      owner_user_id, kind, object_path, name, size_bytes, content_type
    ) values (
      'f1111111-1111-4111-8111-111111111111', 'cuit',
      'f1111111-1111-4111-8111-111111111111/cuit/cccc.pdf',
      'cuit.pdf', -1, 'application/pdf'
    )$$,
  '23514', null,
  'a negative size is rejected'
);

select throws_ok(
  $$insert into public.pyme_document (
      owner_user_id, kind, object_path, name, size_bytes, content_type
    ) values (
      'f9999999-9999-4999-8999-999999999999', 'cuit',
      'f9999999-9999-4999-8999-999999999999/cuit/dddd.pdf',
      'cuit.pdf', 10, 'application/pdf'
    )$$,
  '23503', null,
  'a document cannot point at a non-existent profile (owner FK)'
);

select throws_ok(
  $$insert into public.pyme_document (
      owner_user_id, kind, object_path, name, size_bytes, content_type
    ) values (
      null, 'cuit', 'x/cuit/eeee.pdf', 'cuit.pdf', 10, 'application/pdf'
    )$$,
  '23502', null,
  'a document must have an owner'
);

select * from finish();

rollback;
