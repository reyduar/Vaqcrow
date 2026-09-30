-- Persist the validated AI assessment of an application and hand it to human
-- review atomically (Feature #30, Task #95 / T3a). Until now a successful
-- assessment was returned advisory and never stored, so the application stayed
-- in `awaiting_assessment` and could never reach the human decision
-- (`record_human_decision` requires `human_review`). The assessment row and the
-- `awaiting_assessment -> human_review` transition are one transaction.
--
-- Only the validated assessment (closed schema, cited evidence resolved) and the
-- non-sensitive run metadata (model, prompt version, generation time, source)
-- have a column here. Raw prompts, raw provider output, vendor errors and
-- secrets have none, and are rejected at the contract boundary before they
-- reach this function. One assessment per application; it is immutable once
-- recorded.
--
-- Reversal (no data outside this feature depends on it):
--   drop function if exists public.record_application_assessment(uuid, uuid, uuid, jsonb, jsonb);
--   drop table if exists public.application_assessment;
create table public.application_assessment (
  application_id uuid primary key
    references public.application_review(application_id) on delete cascade,
  -- The caller's per-attempt idempotency key (the `handoffId` of the route).
  attempt_id     uuid not null,
  assessment     jsonb not null,
  metadata       jsonb not null,
  -- Transport correlation of the request that recorded it (traceability only).
  correlation_id uuid not null,
  created_at     timestamptz not null default now(),
  constraint application_assessment_attempt_id_key unique (attempt_id),
  constraint application_assessment_assessment_check check (
    jsonb_typeof(assessment) = 'object'
    and jsonb_typeof(assessment -> 'assessmentId') = 'string'
  ),
  constraint application_assessment_metadata_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

-- Access control: RLS enabled and grants set explicitly in this same migration
-- so no default anon/authenticated grant ever survives even transiently. The API
-- is the only writer and connects as service_role. Zero policies means every
-- non-bypass role is denied by default.
--
-- Supabase grants service_role broad privileges on new tables by default, so the
-- revoke covers service_role too: a recorded assessment is immutable, the API
-- role gets SELECT + INSERT only (same reasoning as `sme_request`).
alter table public.application_assessment enable row level security;

revoke all on public.application_assessment from anon, authenticated, service_role;

grant select, insert on public.application_assessment to service_role;

-- One atomic command boundary. It serializes on the application id, so two
-- attempts racing the same application resolve to replay/conflict instead of a
-- primary-key error, and the row insert and the state transition cannot be
-- separated. Resolution order mirrors `record_assessment_failure_handoff`:
--   1. an assessment already exists -> `replayed` (same attempt id, the stored
--      record wins) or `conflict` (a different attempt already assessed it);
--   2. unknown application -> `not_found`;
--   3. not `awaiting_assessment` -> `state_conflict` with the actual state;
--   4. otherwise insert + conditional transition -> `applied`.
create or replace function public.record_application_assessment(
  p_application_id uuid,
  p_attempt_id uuid,
  p_correlation_id uuid,
  p_assessment jsonb,
  p_metadata jsonb
)
returns table (
  result_kind text,
  application_id uuid,
  attempt_id uuid,
  assessment jsonb,
  metadata jsonb,
  recorded_at timestamptz,
  actual_state text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.application_assessment%rowtype;
  v_inserted public.application_assessment%rowtype;
  v_actual_state text;
  v_updated integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_application_id::text, 0)
  );

  select aa.*
    into v_existing
    from public.application_assessment as aa
   where aa.application_id = p_application_id;

  if found then
    return query select
      case when v_existing.attempt_id = p_attempt_id then 'replayed' else 'conflict' end,
      v_existing.application_id,
      v_existing.attempt_id,
      v_existing.assessment,
      v_existing.metadata,
      v_existing.created_at,
      null::text;
    return;
  end if;

  select ar.state
    into v_actual_state
    from public.application_review as ar
   where ar.application_id = p_application_id;

  if not found then
    return query select
      'not_found'::text, null::uuid, null::uuid, null::jsonb, null::jsonb,
      null::timestamptz, null::text;
    return;
  end if;

  if v_actual_state <> 'awaiting_assessment' then
    return query select
      'state_conflict'::text, null::uuid, null::uuid, null::jsonb, null::jsonb,
      null::timestamptz, v_actual_state;
    return;
  end if;

  insert into public.application_assessment (
    application_id,
    attempt_id,
    assessment,
    metadata,
    correlation_id
  ) values (
    p_application_id,
    p_attempt_id,
    p_assessment,
    p_metadata,
    p_correlation_id
  )
  returning * into v_inserted;

  update public.application_review as ar
     set state = 'human_review',
         last_correlation_id = p_correlation_id
   where ar.application_id = p_application_id
     and ar.state = 'awaiting_assessment';

  get diagnostics v_updated = row_count;

  -- The advisory lock makes this unreachable in practice; if the conditional
  -- update ever matches nothing, abort so the insert above is rolled back.
  if v_updated <> 1 then
    raise exception 'application_assessment: transition lost its precondition'
      using errcode = '40001';
  end if;

  return query select
    'applied'::text,
    v_inserted.application_id,
    v_inserted.attempt_id,
    v_inserted.assessment,
    v_inserted.metadata,
    v_inserted.created_at,
    null::text;
end;
$$;

revoke execute on function public.record_application_assessment(
  uuid, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.record_application_assessment(
  uuid, uuid, uuid, jsonb, jsonb
) to service_role;
