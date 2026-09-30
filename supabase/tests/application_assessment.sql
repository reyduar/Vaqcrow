begin;

select plan(27);

-- Structure and access control ------------------------------------------------

select has_table('public', 'application_assessment', 'application_assessment table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.application_assessment'::regclass),
  true,
  'application_assessment has row-level security enabled'
);

select is(has_table_privilege('anon', 'public.application_assessment', 'select'), false, 'anon cannot read assessments');
select is(has_table_privilege('authenticated', 'public.application_assessment', 'select'), false, 'authenticated cannot read assessments');
select is(has_table_privilege('authenticated', 'public.application_assessment', 'insert'), false, 'authenticated cannot write assessments');
select is(has_table_privilege('service_role', 'public.application_assessment', 'select'), true, 'service role can read assessments');
select is(has_table_privilege('service_role', 'public.application_assessment', 'insert'), true, 'service role can record assessments');
select is(has_table_privilege('service_role', 'public.application_assessment', 'update'), false, 'service role cannot rewrite a recorded assessment');
select is(has_table_privilege('service_role', 'public.application_assessment', 'delete'), false, 'service role cannot delete a recorded assessment');
select is(
  has_function_privilege('anon', 'public.record_application_assessment(uuid, uuid, uuid, jsonb, jsonb)', 'execute'),
  false,
  'anon cannot call the record command'
);
select is(
  has_function_privilege('authenticated', 'public.record_application_assessment(uuid, uuid, uuid, jsonb, jsonb)', 'execute'),
  false,
  'authenticated cannot call the record command'
);
select is(
  has_function_privilege('service_role', 'public.record_application_assessment(uuid, uuid, uuid, jsonb, jsonb)', 'execute'),
  true,
  'service role can call the record command'
);

-- Fixtures ---------------------------------------------------------------------

insert into public.application_review (application_id, state, last_correlation_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'awaiting_assessment', 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', 'human_review',        'cccccccc-cccc-4ccc-8ccc-cccccccccc02'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3', 'awaiting_assessment', 'cccccccc-cccc-4ccc-8ccc-cccccccccc03');

-- Atomic command, as the API's real role ---------------------------------------

set local role service_role;

select is(
  (
    select result_kind
      from public.record_application_assessment(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
        '{"assessmentId":"asm_demo_001","riskBand":"medium"}'::jsonb,
        '{"model":"m","promptVersion":"v1","generatedAt":"2026-09-30T12:00:00.000Z","source":"simulated"}'::jsonb
      )
  ),
  'applied',
  'the first assessment for an awaiting application is applied'
);

select is(
  (select state from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),
  'human_review',
  'recording the assessment moves the application to human_review'
);

select is(
  (select last_correlation_id::text from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
  'the transition stamps the request correlation id'
);

select is(
  (select assessment ->> 'riskBand' from public.application_assessment where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),
  'medium',
  'the assessment row stores the validated assessment'
);

select is(
  (select metadata ->> 'source' from public.application_assessment where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),
  'simulated',
  'the assessment row stores the run metadata'
);

-- Replay: same attempt id, even after the state already moved.
select is(
  (
    select result_kind || ':' || (assessment ->> 'assessmentId')
      from public.record_application_assessment(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee09',
        '{"assessmentId":"asm_other","riskBand":"high"}'::jsonb,
        '{"model":"m","promptVersion":"v1","generatedAt":"2026-09-30T12:00:00.000Z","source":"simulated"}'::jsonb
      )
  ),
  'replayed:asm_demo_001',
  'the same attempt id replays and returns the stored assessment'
);

select is(
  (select count(*)::int from public.application_assessment where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),
  1,
  'a replay records no second assessment'
);

-- Conflict: another attempt against an already assessed application.
select is(
  (
    select result_kind
      from public.record_application_assessment(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
        '{"assessmentId":"asm_other","riskBand":"high"}'::jsonb,
        '{"model":"m","promptVersion":"v1","generatedAt":"2026-09-30T12:00:00.000Z","source":"simulated"}'::jsonb
      )
  ),
  'conflict',
  'a different attempt against an assessed application is a conflict'
);

-- State conflict: the application is not awaiting its assessment.
select is(
  (
    select result_kind || ':' || actual_state
      from public.record_application_assessment(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', 'dddddddd-dddd-4ddd-8ddd-dddddddddd03',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03',
        '{"assessmentId":"asm_demo_001","riskBand":"low"}'::jsonb,
        '{"model":"m","promptVersion":"v1","generatedAt":"2026-09-30T12:00:00.000Z","source":"simulated"}'::jsonb
      )
  ),
  'state_conflict:human_review',
  'an application outside awaiting_assessment is a state_conflict with its actual state'
);

select is(
  (select count(*)::int from public.application_assessment where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2'),
  0,
  'a state_conflict records nothing'
);

select is(
  (
    select result_kind
      from public.record_application_assessment(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaff', 'dddddddd-dddd-4ddd-8ddd-dddddddddd04',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04',
        '{"assessmentId":"asm_demo_001","riskBand":"low"}'::jsonb,
        '{"model":"m","promptVersion":"v1","generatedAt":"2026-09-30T12:00:00.000Z","source":"simulated"}'::jsonb
      )
  ),
  'not_found',
  'an unknown application is not_found'
);

-- Constraint checks (the row shape is validated by the database too) ----------

select throws_ok(
  $$select * from public.record_application_assessment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3', 'dddddddd-dddd-4ddd-8ddd-dddddddddd05',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05',
    '[]'::jsonb,
    '{"source":"simulated"}'::jsonb)$$,
  '23514', null, 'a non-object assessment is rejected'
);

select throws_ok(
  $$select * from public.record_application_assessment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3', 'dddddddd-dddd-4ddd-8ddd-dddddddddd05',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05',
    '{"assessmentId":"asm_demo_001"}'::jsonb,
    '"text"'::jsonb)$$,
  '23514', null, 'non-object metadata is rejected'
);

select is(
  (select state from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3'),
  'awaiting_assessment',
  'a rejected assessment leaves the application untouched (statement rolled back)'
);

reset role;

-- Cascade ----------------------------------------------------------------------

delete from public.application_review where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1';

select is(
  (select count(*)::int from public.application_assessment where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),
  0,
  'deleting the application removes its assessment'
);

select * from finish();

rollback;
