begin;

select plan(34);

-- Per-document KYC/KYB verdicts (Feature #410, U1, decision D8).
--
-- `public.document_verdict` is service_role-only: RLS is enabled and the grants
-- are set explicitly in the migration, with zero policies. `service_role`
-- bypasses RLS, so the API is the single writer; there is no client
-- (anon/authenticated) path at all. One row per (application, document) holds
-- the current verdict and the admin who set it.

-- Structure -------------------------------------------------------------------

select has_table('public', 'document_verdict', 'document_verdict table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.document_verdict'::regclass),
  true,
  'document_verdict has row-level security enabled'
);

select has_column('public', 'document_verdict', 'application_id', 'has an application_id column');
select has_column('public', 'document_verdict', 'document_id', 'has a document_id column');
select has_column('public', 'document_verdict', 'verdict', 'has a verdict column');
select has_column('public', 'document_verdict', 'actor', 'has an actor column');
select has_column('public', 'document_verdict', 'actor_user_id', 'has an actor_user_id column');
select has_column('public', 'document_verdict', 'created_at', 'has a created_at column');
select has_column('public', 'document_verdict', 'updated_at', 'has an updated_at column');

select col_not_null('public', 'document_verdict', 'actor', 'actor is required');
select col_not_null('public', 'document_verdict', 'actor_user_id', 'actor_user_id is required');

select col_is_pk(
  'public', 'document_verdict', array['application_id', 'document_id'],
  'the primary key is (application_id, document_id)'
);

select fk_ok(
  'public', 'document_verdict', 'application_id',
  'public', 'application_review', 'application_id',
  'application_id references application_review'
);

select fk_ok(
  'public', 'document_verdict', 'document_id',
  'public', 'pyme_document', 'id',
  'document_id references pyme_document'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'document_verdict'),
  0,
  'document_verdict has no policies: the API (service_role) is the only writer'
);

-- Access control: nobody but service_role ------------------------------------

select is(has_table_privilege('anon', 'public.document_verdict', 'select'), false, 'anon cannot read document_verdict');
select is(has_table_privilege('anon', 'public.document_verdict', 'insert'), false, 'anon cannot insert document_verdict');
select is(has_table_privilege('anon', 'public.document_verdict', 'update'), false, 'anon cannot update document_verdict');
select is(has_table_privilege('authenticated', 'public.document_verdict', 'select'), false, 'authenticated cannot read document_verdict');
select is(has_table_privilege('authenticated', 'public.document_verdict', 'insert'), false, 'authenticated cannot insert document_verdict');
select is(has_table_privilege('authenticated', 'public.document_verdict', 'update'), false, 'authenticated cannot update document_verdict');
select is(has_table_privilege('authenticated', 'public.document_verdict', 'delete'), false, 'authenticated cannot delete document_verdict');
select is(has_table_privilege('service_role', 'public.document_verdict', 'select'), true, 'service role can read document_verdict');
select is(has_table_privilege('service_role', 'public.document_verdict', 'insert'), true, 'service role can insert document_verdict');
select is(has_table_privilege('service_role', 'public.document_verdict', 'update'), true, 'service role can update document_verdict');
select is(has_table_privilege('service_role', 'public.document_verdict', 'delete'), false, 'service role cannot delete document_verdict');

-- Behavior --------------------------------------------------------------------
-- Seeded as the test owner (profile rows hang off auth.users), then exercised as
-- service_role, the role the API connects as, so the write grants the migration
-- actually keeps are the ones under test.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'b1111111-1111-4111-8111-111111111111',
  'verdict-owner@example.test',
  '{"role": "PYME", "display_name": "Verdict Owner"}'::jsonb, '{}'::jsonb
);

insert into public.application_review (application_id, state, last_correlation_id)
values ('a3333333-3333-4333-8333-333333333333', 'human_review', 'c5555555-5555-4555-8555-555555555555');

insert into public.pyme_document (id, owner_user_id, kind, object_path, name, size_bytes, content_type)
values (
  'd1111111-1111-4111-8111-111111111111',
  'b1111111-1111-4111-8111-111111111111',
  'cuit',
  'b1111111-1111-4111-8111-111111111111/cuit/d1111111-cuit.pdf',
  'cuit.pdf',
  1024,
  'application/pdf'
);

set local role service_role;

-- Stamped in the past so the trigger's advance is observable within one
-- transaction (`now()` is the transaction timestamp).
insert into public.document_verdict (
  application_id, document_id, verdict, actor, actor_user_id, created_at, updated_at
) values (
  'a3333333-3333-4333-8333-333333333333', 'd1111111-1111-4111-8111-111111111111', 'request',
  'Admin Vaqcrow', 'e1111111-1111-4111-8111-111111111111',
  timestamptz '2000-01-01 00:00:00+00', timestamptz '2000-01-01 00:00:00+00'
);

select is(
  (select verdict from public.document_verdict
    where application_id = 'a3333333-3333-4333-8333-333333333333'
      and document_id = 'd1111111-1111-4111-8111-111111111111'),
  'request',
  'a verdict row is stored'
);

update public.document_verdict
  set verdict = 'valid'
  where application_id = 'a3333333-3333-4333-8333-333333333333'
    and document_id = 'd1111111-1111-4111-8111-111111111111';

select is(
  (select updated_at > created_at from public.document_verdict
    where application_id = 'a3333333-3333-4333-8333-333333333333'
      and document_id = 'd1111111-1111-4111-8111-111111111111'),
  true,
  'an UPDATE advances updated_at'
);

select throws_ok(
  $$update public.document_verdict set verdict = 'approved'
    where application_id = 'a3333333-3333-4333-8333-333333333333'$$,
  '23514', null,
  'an unknown verdict is rejected'
);

select throws_ok(
  $$insert into public.document_verdict (application_id, document_id, verdict, actor, actor_user_id)
    values ('a3333333-3333-4333-8333-333333333333', 'd1111111-1111-4111-8111-111111111111',
            'invalid', 'Admin Vaqcrow', 'e1111111-1111-4111-8111-111111111111')$$,
  '23505', null,
  'one verdict per (application, document): a second insert is a unique violation'
);

select throws_ok(
  $$insert into public.document_verdict (application_id, document_id, verdict, actor, actor_user_id)
    values ('a9999999-9999-4999-8999-999999999999', 'd1111111-1111-4111-8111-111111111111',
            'valid', 'Admin Vaqcrow', 'e1111111-1111-4111-8111-111111111111')$$,
  '23503', null,
  'a verdict cannot point at a non-existent application'
);

select throws_ok(
  $$insert into public.document_verdict (application_id, document_id, verdict, actor, actor_user_id)
    values ('a3333333-3333-4333-8333-333333333333', 'd9999999-9999-4999-8999-999999999999',
            'valid', 'Admin Vaqcrow', 'e1111111-1111-4111-8111-111111111111')$$,
  '23503', null,
  'a verdict cannot point at a non-existent document'
);

select throws_ok(
  $$delete from public.pyme_document where id = 'd1111111-1111-4111-8111-111111111111'$$,
  '23503', null,
  'a document with a verdict cannot be deleted (on delete restrict)'
);

select throws_ok(
  $$delete from public.application_review
    where application_id = 'a3333333-3333-4333-8333-333333333333'$$,
  '23503', null,
  'an application with a verdict cannot be deleted (on delete restrict)'
);

reset role;

select * from finish();

rollback;
