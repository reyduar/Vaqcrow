begin;

select plan(11);

-- An ADMIN has no database-level reach beyond its own profile: admin reads go
-- through the API with the service role. A JWT carrying role ADMIN (in
-- app_metadata, as the seeded super admin's does) querying the database
-- directly is just another `authenticated` caller. The fixture admin uses its own
-- username so the test also runs against a stack where the super admin
-- (`vaqcrow.admin`) is already seeded.

-- Fixtures (as the test owner, bypassing RLS) ---------------------------------

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'pyme@example.test', '{"role": "PYME", "display_name": "Scope Pyme"}'::jsonb, '{}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'inversor@example.test', '{"role": "INVERSOR", "display_name": "Scope Inversor"}'::jsonb, '{}'::jsonb),
  (
    'a5555555-5555-4555-8555-555555555555', 'admin@example.test', '{"role": "INVERSOR"}'::jsonb,
    '{"role": "ADMIN", "display_name": "Scope Admin", "username": "scope.admin.test"}'::jsonb
  );

insert into public.audit_log (actor_user_id, action, target_type, target_id)
values ('a5555555-5555-4555-8555-555555555555', 'decision.recorded', 'application', 'app-1');

insert into public.application_review (application_id, state, last_correlation_id)
values ('b1111111-1111-4111-8111-111111111111', 'human_review', 'c1111111-1111-4111-8111-111111111111');

insert into public.human_decision (decision_id, application_id, outcome, actor, reason, correlation_id)
values (
  'd1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111',
  'rejected', 'Admin Vaqcrow', 'insufficient sales history', 'c1111111-1111-4111-8111-111111111111'
);

select is(
  (select role from public.profile where user_id = 'a5555555-5555-4555-8555-555555555555'),
  'ADMIN',
  'the fixture admin has an ADMIN profile'
);
select is(
  (select count(*)::int from public.profile where user_id in (
    'a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'a5555555-5555-4555-8555-555555555555'
  )),
  3,
  'three profiles exist, so a single visible row is a real restriction'
);

-- Direct queries with an ADMIN JWT ---------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'a5555555-5555-4555-8555-555555555555',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'ADMIN')
  )::text,
  true
);

select is(
  (select count(*)::int from public.profile),
  1,
  'an ADMIN JWT sees exactly one profile row'
);
select is(
  (select user_id::text || ':' || role from public.profile),
  'a5555555-5555-4555-8555-555555555555:ADMIN',
  'the only visible profile is the admin''s own'
);
select is(
  (select count(*)::int from public.profile where user_id in (
    'a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222'
  )),
  0,
  'an ADMIN JWT cannot read other users'' profiles even by id'
);

select throws_ok(
  $$select count(*) from public.audit_log$$,
  '42501', null, 'an ADMIN JWT cannot read the audit log'
);
select throws_ok(
  $$select count(*) from public.application_review$$,
  '42501', null, 'an ADMIN JWT cannot read application reviews'
);
select throws_ok(
  $$select count(*) from public.human_decision$$,
  '42501', null, 'an ADMIN JWT cannot read human decisions'
);
select throws_ok(
  $$update public.profile set role = 'ADMIN' where user_id = 'a1111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'an ADMIN JWT cannot promote another user'
);
select throws_ok(
  $$insert into public.human_decision (decision_id, application_id, outcome, actor, reason, correlation_id)
    values ('d2222222-2222-4222-8222-222222222222', 'b1111111-1111-4111-8111-111111111111',
            'rejected', 'Admin Vaqcrow', 'direct write', 'c1111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'an ADMIN JWT cannot record a decision directly'
);

reset role;

select is(
  (select count(*)::int from public.human_decision where application_id = 'b1111111-1111-4111-8111-111111111111'),
  1,
  'the denied direct write left no decision behind'
);

select * from finish();

rollback;
