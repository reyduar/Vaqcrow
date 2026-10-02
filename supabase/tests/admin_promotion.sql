begin;

select plan(9);

-- Reproduces the sequence GoTrue's admin createUser really runs: INSERT into
-- auth.users WITHOUT the caller's app_metadata, then UPDATE raw_app_meta_data.

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'aaaaaaa1-0000-4000-8000-000000000001', 'promote@example.test',
  '{"role": "INVERSOR", "display_name": "Admin Vaqcrow"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

select is(
  (select role from public.profile where user_id = 'aaaaaaa1-0000-4000-8000-000000000001'),
  'INVERSOR',
  'the insert step (no app role) creates an INVERSOR profile'
);

update auth.users
set raw_app_meta_data = raw_app_meta_data
  || '{"role": "ADMIN", "display_name": "Admin Vaqcrow", "username": "fixture.promoted.admin"}'::jsonb
where id = 'aaaaaaa1-0000-4000-8000-000000000001';

select is(
  (select role || ':' || display_name || ':' || username from public.profile where user_id = 'aaaaaaa1-0000-4000-8000-000000000001'),
  'ADMIN:Admin Vaqcrow:fixture.promoted.admin',
  'the app_metadata update promotes the profile to ADMIN with display name and username'
);

-- Updates that do not grant ADMIN leave the role alone.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'aaaaaaa2-0000-4000-8000-000000000002', 'plain@example.test',
  '{"role": "PYME", "display_name": "Plain"}'::jsonb, '{}'::jsonb
);

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "display_name": "Hacked"}'::jsonb
where id = 'aaaaaaa2-0000-4000-8000-000000000002';

select is(
  (select role || ':' || display_name from public.profile where user_id = 'aaaaaaa2-0000-4000-8000-000000000002'),
  'PYME:Plain',
  'an app_metadata update without role ADMIN leaves role and display name unchanged'
);

update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role": "ADMIN"}'::jsonb
where id = 'aaaaaaa2-0000-4000-8000-000000000002';

select is(
  (select role from public.profile where user_id = 'aaaaaaa2-0000-4000-8000-000000000002'),
  'PYME',
  'an update of user_metadata role ADMIN does nothing'
);

-- A blank display name never overwrites the existing one.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'aaaaaaa3-0000-4000-8000-000000000003', 'blank@example.test',
  '{"role": "INVERSOR", "display_name": "Keep Me"}'::jsonb, '{}'::jsonb
);

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "ADMIN", "display_name": "   "}'::jsonb
where id = 'aaaaaaa3-0000-4000-8000-000000000003';

select is(
  (select role || ':' || display_name || ':' || coalesce(username, '-') from public.profile where user_id = 'aaaaaaa3-0000-4000-8000-000000000003'),
  'ADMIN:Keep Me:-',
  'promotion keeps the display name and username when app_metadata gives none'
);

-- A missing profile row is created rather than failing.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'aaaaaaa4-0000-4000-8000-000000000004', 'orphan@example.test',
  '{"role": "INVERSOR"}'::jsonb, '{}'::jsonb
);
delete from public.profile where user_id = 'aaaaaaa4-0000-4000-8000-000000000004';

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "ADMIN"}'::jsonb
where id = 'aaaaaaa4-0000-4000-8000-000000000004';

select is(
  (select role || ':' || display_name from public.profile where user_id = 'aaaaaaa4-0000-4000-8000-000000000004'),
  'ADMIN:orphan',
  'promotion creates the profile when none exists'
);

-- Access control ------------------------------------------------------------------

select is(
  has_function_privilege('anon', 'public.promote_admin_on_app_metadata()', 'execute'),
  false,
  'anon cannot execute the promotion function'
);
select is(
  has_function_privilege('authenticated', 'public.promote_admin_on_app_metadata()', 'execute'),
  false,
  'authenticated cannot execute the promotion function'
);
select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_app_metadata_updated' and not tgisinternal),
  1,
  'the app_metadata update trigger exists on auth.users'
);

select * from finish();

rollback;
