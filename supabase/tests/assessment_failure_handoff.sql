begin;

select plan(20);

-- Structure and access control ------------------------------------------------

select has_table('public', 'assessment_failure_handoff', 'handoff table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.assessment_failure_handoff'::regclass),
  true,
  'handoff table has row-level security enabled'
);

select is(
  has_table_privilege('anon', 'public.assessment_failure_handoff', 'select'),
  false,
  'anon cannot read handoffs'
);
select is(
  has_table_privilege('authenticated', 'public.assessment_failure_handoff', 'insert'),
  false,
  'authenticated cannot write handoffs'
);
select is(
  has_table_privilege('service_role', 'public.assessment_failure_handoff', 'insert'),
  true,
  'service role can persist handoffs'
);
select is(
  has_function_privilege(
    'anon', 'public.record_assessment_failure_handoff(uuid, uuid, text, jsonb, jsonb)', 'execute'
  ),
  false,
  'anon cannot call the handoff command'
);
select is(
  has_function_privilege(
    'service_role', 'public.record_assessment_failure_handoff(uuid, uuid, text, jsonb, jsonb)', 'execute'
  ),
  true,
  'service role can call the handoff command'
);

-- Raw provider diagnostics have no column to persist into.
select hasnt_column('public', 'assessment_failure_handoff', 'message', 'no raw provider message column');
select hasnt_column('public', 'assessment_failure_handoff', 'details', 'no raw provider details column');
select hasnt_column('public', 'assessment_failure_handoff', 'raw_output', 'no raw provider output column');

-- Constraint checks ------------------------------------------------------------

insert into public.application_review (application_id, state, last_correlation_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'awaiting_assessment', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'approved', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0');

select throws_ok(
  $$
    insert into public.assessment_failure_handoff (
      application_id, correlation_id, failure_code, evidence_bundle
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'rate_limited', '{"periods": [{"period": "2026-01"}], "findings": []}'::jsonb
    )
  $$,
  '23514',
  null,
  'a failure code outside the closed set is rejected'
);

select throws_ok(
  $$
    insert into public.assessment_failure_handoff (
      application_id, correlation_id, failure_code, evidence_bundle
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'timeout', '{"periods": [], "findings": []}'::jsonb
    )
  $$,
  '23514',
  null,
  'an empty evidence series is rejected'
);

-- Atomic command outcomes ------------------------------------------------------

select is(
  (
    select result_kind
      from public.record_assessment_failure_handoff(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'invalid_output',
        ('{"periods": [{"period": "2026-01", "amountArs": 1200000, "status": "reported",'
          ' "evidenceRef": "sales:2026-01", "simuladoLabel": "SIMULADO"}], "findings": []}')::jsonb,
        ('{"model": "simulated-underwriter", "promptVersion": "prompt-v1",'
          ' "generatedAt": "2026-09-28T12:00:00Z", "source": "simulated"}')::jsonb
      )
  ),
  'applied',
  'the first handoff for an awaiting application is applied'
);

select is(
  (
    select count(*)::int
      from public.assessment_failure_handoff
     where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  1,
  'exactly one durable handoff exists per application'
);

select is(
  (
    select result_kind
      from public.record_assessment_failure_handoff(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'invalid_output',
        '{"periods": [{"period": "2026-02"}], "findings": []}'::jsonb,
        null
      )
  ),
  'replayed',
  'the same correlation is a replay'
);

select is(
  (
    select evidence_bundle -> 'periods' -> 0 ->> 'amountArs'
      from public.record_assessment_failure_handoff(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'invalid_output',
        '{"periods": [{"period": "2026-02"}], "findings": []}'::jsonb,
        null
      )
  ),
  '1200000',
  'a replay returns the stored canonical evidence, not the resubmitted payload'
);

select is(
  (
    select result_kind
      from public.record_assessment_failure_handoff(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'timeout',
        '{"periods": [{"period": "2026-01"}], "findings": []}'::jsonb,
        null
      )
  ),
  'correlation_conflict',
  'a competing correlation is an explicit conflict, not a second record'
);

select is(
  (
    select result_kind
      from public.record_assessment_failure_handoff(
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
        'ffffffff-ffff-4fff-8fff-fffffffffff1',
        'timeout',
        '{"periods": [{"period": "2026-01"}], "findings": []}'::jsonb,
        null
      )
  ),
  'not_found',
  'an unknown application is not found'
);

select is(
  (
    select result_kind || ':' || coalesce(actual_state, 'null')
      from public.record_assessment_failure_handoff(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        'ffffffff-ffff-4fff-8fff-fffffffffff2',
        'timeout',
        '{"periods": [{"period": "2026-01"}], "findings": []}'::jsonb,
        null
      )
  ),
  'state_conflict:approved',
  'a handoff outside awaiting_assessment reports the actual state'
);

-- Cascade ----------------------------------------------------------------------

delete from public.application_review
 where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

select is(
  (
    select count(*)::int
      from public.assessment_failure_handoff
     where application_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  0,
  'deleting the application removes its handoff'
);

select * from finish();

rollback;
