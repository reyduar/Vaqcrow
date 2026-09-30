begin;

select plan(23);

-- Structure and access control ------------------------------------------------

select has_table('public', 'sme_request', 'sme_request table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.sme_request'::regclass),
  true,
  'sme_request has row-level security enabled'
);

select is(has_table_privilege('anon', 'public.sme_request', 'select'), false, 'anon cannot read requests');
select is(has_table_privilege('authenticated', 'public.sme_request', 'insert'), false, 'authenticated cannot write requests');
select is(has_table_privilege('service_role', 'public.sme_request', 'insert'), true, 'service role can persist requests');
select is(has_table_privilege('service_role', 'public.sme_request', 'update'), false, 'service role cannot rewrite a submitted request');
select is(has_table_privilege('service_role', 'public.sme_request', 'delete'), false, 'service role cannot delete a submitted request');
select is(
  has_function_privilege('anon', 'public.submit_sme_request(uuid, uuid, text, numeric, text, text)', 'execute'),
  false,
  'anon cannot call the submit command'
);
select is(
  has_function_privilege('service_role', 'public.submit_sme_request(uuid, uuid, text, numeric, text, text)', 'execute'),
  true,
  'service role can call the submit command'
);

-- Atomic command -------------------------------------------------------------

select is(
  (
    select result_kind
      from public.submit_sme_request(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'sme:SYN-PH-0001', 15000000, '2026-01', '2026-08'
      )
  ),
  'applied',
  'the first submission is applied'
);

select is(
  (select state from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  'awaiting_assessment',
  'the application is created in awaiting_assessment'
);

select is(
  (select declared_total_ars::text from public.sme_request where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  '15000000',
  'the request row is created with the application'
);

select is(
  (
    select result_kind || ':' || application_id::text
      from public.submit_sme_request(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'sme:SYN-PH-0001', 15000000, '2026-01', '2026-08'
      )
  ),
  'replayed:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'the same correlation id replays and returns the existing application'
);

select is(
  (select count(*)::int from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  0,
  'a replay creates no second application'
);

-- Constraint checks ----------------------------------------------------------

select throws_ok(
  $$select * from public.submit_sme_request(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'sme:SYN-PH-0001', -1, '2026-01', '2026-08')$$,
  '23514', null, 'a negative declared total is rejected'
);

select throws_ok(
  $$select * from public.submit_sme_request(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'sme:SYN-PH-0001', 1, '2026-13', '2026-14')$$,
  '23514', null, 'a malformed period is rejected'
);

select throws_ok(
  $$select * from public.submit_sme_request(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'sme:SYN-PH-0001', 1, '2026-08', '2026-01')$$,
  '23514', null, 'a period end before the start is rejected'
);

select throws_ok(
  $$select * from public.submit_sme_request(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    '', 1, '2026-01', '2026-08')$$,
  '23514', null, 'an empty SME reference is rejected'
);

select is(
  (select count(*)::int from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'),
  0,
  'a rejected request leaves no orphan application (statement rolled back)'
);

-- Cascade --------------------------------------------------------------------

delete from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

select is(
  (select count(*)::int from public.sme_request where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  0,
  'deleting the application removes its request'
);

-- The API's real role -----------------------------------------------------------
-- The assertions above run as the migration owner. The API connects as
-- service_role, so prove that role can complete the atomic insert itself (both
-- tables) with only the grants the migration gives it.

set local role service_role;

select is(
  (
    select result_kind
      from public.submit_sme_request(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
        'sme:SYN-PH-0001', 9000000, '2026-01', '2026-06'
      )
  ),
  'applied',
  'service_role can call the submit command and it is applied'
);

select is(
  (select state from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'),
  'awaiting_assessment',
  'service_role submit created the application_review row'
);

select is(
  (select declared_total_ars::text from public.sme_request where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'),
  '9000000',
  'service_role submit created the sme_request row'
);

reset role;

select * from finish();

rollback;
