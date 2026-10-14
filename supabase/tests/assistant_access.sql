begin;

select plan(33);

-- Help assistant access flag and usage window (Feature #499, WU2).
--
-- `public.profile.chat_enabled` is the per-user access flag (off by default);
-- `public.assistant_question` records one timestamp per accepted question for
-- the 5-per-24h rolling cap. The API serves the assistant as `service_role`, so
-- neither browser role touches the table directly, and the flag is enforced by
-- the API rather than by a policy.

-- Structure -------------------------------------------------------------------

select has_table('public', 'assistant_question', 'assistant_question table exists');

select has_column('public', 'assistant_question', 'id', 'assistant_question has an id column');
select has_column('public', 'assistant_question', 'user_id', 'assistant_question has a user_id column');
select has_column('public', 'assistant_question', 'asked_at', 'assistant_question has an asked_at column');

select col_type_is('public', 'assistant_question', 'id', 'bigint', 'id is a bigint');
select col_type_is('public', 'assistant_question', 'user_id', 'uuid', 'user_id is a uuid');
select col_type_is('public', 'assistant_question', 'asked_at', 'timestamp with time zone', 'asked_at is a timestamptz');

select col_not_null('public', 'assistant_question', 'user_id', 'a question always has a user');
select col_not_null('public', 'assistant_question', 'asked_at', 'a question is always timestamped');
select col_has_default('public', 'assistant_question', 'asked_at', 'asked_at defaults to now()');

select has_column('public', 'profile', 'chat_enabled', 'profile has a chat_enabled column');
select col_type_is('public', 'profile', 'chat_enabled', 'boolean', 'chat_enabled is a boolean');
select col_not_null('public', 'profile', 'chat_enabled', 'chat_enabled is never null');
select col_has_default('public', 'profile', 'chat_enabled', 'chat_enabled defaults (off by default)');

select has_index('public', 'assistant_question', 'assistant_question_pkey', 'the id primary key exists');
select has_index(
  'public',
  'assistant_question',
  'assistant_question_user_window_idx',
  'the per-user window index exists'
);

-- Access control: RLS on, no policy, nobody but service_role touches the table --

select is(
  (select relrowsecurity from pg_class where oid = 'public.assistant_question'::regclass),
  true,
  'assistant_question has row-level security enabled'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'assistant_question'),
  0,
  'assistant_question has no policy: it is API-only'
);

select is(has_table_privilege('anon', 'public.assistant_question', 'select'), false, 'anon cannot read assistant_question');
select is(has_table_privilege('anon', 'public.assistant_question', 'insert'), false, 'anon cannot insert assistant_question');
select is(has_table_privilege('authenticated', 'public.assistant_question', 'select'), false, 'authenticated cannot read assistant_question');
select is(has_table_privilege('authenticated', 'public.assistant_question', 'insert'), false, 'authenticated cannot insert assistant_question');
select is(has_table_privilege('authenticated', 'public.assistant_question', 'update'), false, 'authenticated cannot update assistant_question');
select is(has_table_privilege('authenticated', 'public.assistant_question', 'delete'), false, 'authenticated cannot delete assistant_question');
select is(has_table_privilege('service_role', 'public.assistant_question', 'select'), true, 'service role can read assistant_question');
select is(has_table_privilege('service_role', 'public.assistant_question', 'insert'), true, 'service role can insert assistant_question');
select is(has_table_privilege('service_role', 'public.assistant_question', 'update'), false, 'service role cannot update assistant_question');
select is(has_table_privilege('service_role', 'public.assistant_question', 'delete'), false, 'service role cannot delete assistant_question');

-- Behavior ---------------------------------------------------------------------

-- A signup creates the profile; the flag is off by default (D9).
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  '44444444-4444-4444-8444-444444444444', 'asistente@example.test',
  '{"role": "INVERSOR", "display_name": "Ana"}'::jsonb, '{}'::jsonb
);

select is(
  (select chat_enabled from public.profile where user_id = '44444444-4444-4444-8444-444444444444'),
  false,
  'a new profile has assistant access disabled'
);

set local role service_role;

update public.profile
  set chat_enabled = true
  where user_id = '44444444-4444-4444-8444-444444444444';

select is(
  (select chat_enabled from public.profile where user_id = '44444444-4444-4444-8444-444444444444'),
  true,
  'the API can enable a user''s assistant access'
);

-- An unknown user is refused by the foreign key.
select throws_ok(
  $$insert into public.assistant_question (user_id, asked_at)
    values ('99999999-9999-4999-8999-999999999999', now())$$,
  '23503', null,
  'a question for an unknown user is refused'
);

-- Two recent questions and one outside the window.
insert into public.assistant_question (user_id, asked_at) values
  ('44444444-4444-4444-8444-444444444444', now()),
  ('44444444-4444-4444-8444-444444444444', now()),
  ('44444444-4444-4444-8444-444444444444', now() - interval '25 hours');

select is(
  (select count(*)::int from public.assistant_question
    where user_id = '44444444-4444-4444-8444-444444444444'
      and asked_at >= now() - interval '24 hours'),
  2,
  'the rolling 24h window counts only the questions inside it'
);

reset role;

set local role authenticated;
select throws_ok(
  $$select count(*) from public.assistant_question$$,
  '42501', null,
  'an authenticated session cannot read the table directly'
);
reset role;

select * from finish();

rollback;
