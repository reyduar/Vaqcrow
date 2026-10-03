begin;

select plan(37);

-- Structure and access control ------------------------------------------------

select has_table('public', 'profile', 'profile table exists');
select has_table('public', 'audit_log', 'audit_log table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.profile'::regclass),
  true,
  'profile has row-level security enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  true,
  'audit_log has row-level security enabled'
);

select is(has_table_privilege('anon', 'public.profile', 'select'), false, 'anon cannot read profiles');
select is(has_table_privilege('authenticated', 'public.profile', 'select'), true, 'authenticated can read profiles (filtered by policy)');
select is(has_table_privilege('authenticated', 'public.profile', 'insert'), false, 'authenticated cannot insert profiles');
select is(has_table_privilege('authenticated', 'public.profile', 'update'), false, 'authenticated cannot update profiles');
select is(has_table_privilege('service_role', 'public.profile', 'insert'), true, 'service role can insert profiles');
select is(has_table_privilege('service_role', 'public.profile', 'update'), true, 'service role can update profiles');
select is(has_table_privilege('service_role', 'public.profile', 'delete'), false, 'service role cannot delete profiles directly');

select is(has_table_privilege('anon', 'public.audit_log', 'select'), false, 'anon cannot read the audit log');
select is(has_table_privilege('authenticated', 'public.audit_log', 'select'), false, 'authenticated cannot read the audit log');
select is(has_table_privilege('authenticated', 'public.audit_log', 'insert'), false, 'authenticated cannot write the audit log');
select is(has_table_privilege('service_role', 'public.audit_log', 'select'), true, 'service role can read the audit log');
select is(has_table_privilege('service_role', 'public.audit_log', 'insert'), true, 'service role can append to the audit log');
select is(has_table_privilege('service_role', 'public.audit_log', 'update'), false, 'service role cannot update the audit log');
select is(has_table_privilege('service_role', 'public.audit_log', 'delete'), false, 'service role cannot delete from the audit log');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'profile' and policyname = 'profile_select_own'),
  1,
  'the profile_select_own policy exists'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'audit_log'),
  0,
  'audit_log has no policies'
);

select is(
  has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  false,
  'anon cannot execute the signup trigger function'
);
select is(
  has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  false,
  'authenticated cannot execute the signup trigger function'
);

-- Signup trigger -------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  '11111111-1111-4111-8111-111111111111', 'pyme@example.test',
  '{"role": "PYME", "display_name": "  Panadería Sol  "}'::jsonb, '{}'::jsonb
);

select is(
  (select role || ':' || display_name from public.profile where user_id = '11111111-1111-4111-8111-111111111111'),
  'PYME:Panadería Sol',
  'a PYME signup creates a PYME profile with the trimmed display name'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values ('22222222-2222-4222-8222-222222222222', 'inversor@example.test', '{"role": "INVERSOR"}'::jsonb, '{}'::jsonb)$$,
  '22023', 'display name is required (at least 2 characters)',
  'an INVERSOR signup without a display name is rejected (no email-derived name)'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values ('22222222-2222-4222-8222-222222222223', 'blank@example.test', '{"role": "PYME", "display_name": "   "}'::jsonb, '{}'::jsonb)$$,
  '22023', 'display name is required (at least 2 characters)',
  'a PYME signup with a blank display name is rejected'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values ('22222222-2222-4222-8222-222222222224', 'short@example.test', '{"role": "INVERSOR", "display_name": " A "}'::jsonb, '{}'::jsonb)$$,
  '22023', 'display name is required (at least 2 characters)',
  'a signup with a 1-character display name is rejected'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values ('22222222-2222-4222-8222-222222222225', 'admin-noname@example.test', '{}'::jsonb, '{"role": "ADMIN"}'::jsonb)$$,
  '22023', 'display name is required (at least 2 characters)',
  'an ADMIN insert (app_metadata) without a display name is rejected'
);

select is(
  (select count(*)::int from public.profile where user_id in (
    '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222223',
    '22222222-2222-4222-8222-222222222224', '22222222-2222-4222-8222-222222222225'
  )),
  0,
  'a signup rejected for its display name creates no profile row'
);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  '22222222-2222-4222-8222-222222222226', 'two@example.test',
  '{"role": "INVERSOR", "display_name": " Al "}'::jsonb, '{}'::jsonb
);

select is(
  (select role || ':' || display_name from public.profile where user_id = '22222222-2222-4222-8222-222222222226'),
  'INVERSOR:Al',
  'a signup with a 2-character display name is accepted'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values ('33333333-3333-4333-8333-333333333333', 'evil@example.test', '{"role": "ADMIN"}'::jsonb, '{}'::jsonb)$$,
  null, null, 'a signup asking for ADMIN in user_metadata fails'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values ('44444444-4444-4444-8444-444444444444', 'norole@example.test', '{}'::jsonb, '{}'::jsonb)$$,
  null, null, 'a signup without a role fails'
);

select is(
  (select count(*)::int from auth.users where id in ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')),
  0,
  'a rejected signup leaves no auth user behind'
);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  '55555555-5555-4555-8555-555555555555', 'admin@example.test',
  '{"role": "PYME"}'::jsonb,
  '{"role": "ADMIN", "display_name": "Admin Vaqcrow", "username": "fixture.identity.admin"}'::jsonb
);

select is(
  (select role || ':' || display_name || ':' || username from public.profile where user_id = '55555555-5555-4555-8555-555555555555'),
  'ADMIN:Admin Vaqcrow:fixture.identity.admin',
  'app_metadata role ADMIN creates an ADMIN profile (service-role-only path)'
);

-- Audit log --------------------------------------------------------------------

insert into public.audit_log (actor_user_id, action, target_type, target_id, detail)
values ('55555555-5555-4555-8555-555555555555', 'decision.recorded', 'application', 'app-1', '{"outcome": "approved"}'::jsonb);

select is(
  (select count(*)::int from public.audit_log where action = 'decision.recorded'),
  1,
  'an audit entry can be appended'
);

select throws_ok(
  $$insert into public.audit_log (actor_user_id, action, target_type, target_id)
    values ('55555555-5555-4555-8555-555555555555', 'Bad Action!', 'application', 'app-1')$$,
  '23514', null, 'a malformed action is rejected'
);

-- RLS behavior -----------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*)::int from public.profile),
  1,
  'an authenticated user sees only their own profile row'
);
select is(
  (select user_id::text from public.profile),
  '11111111-1111-4111-8111-111111111111',
  'the visible row is the caller''s own'
);

reset role;

select * from finish();

rollback;
