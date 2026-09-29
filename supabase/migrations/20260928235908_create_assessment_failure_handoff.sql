-- Persist the sanitized assessment-attempt handoff manual review reads (Feature
-- #22, Task #71). One durable record per application: only the closed failure
-- code, the validated synthetic evidence bundle and the declared provider
-- provenance cross this boundary. Raw provider output, vendor errors, secrets,
-- PII and seeds have no column here and are rejected at the contract boundary
-- before they ever reach this function.
create table public.assessment_failure_handoff (
  application_id      uuid primary key
    references public.application_review(application_id) on delete cascade,
  correlation_id      uuid not null,
  failure_code        text not null,
  evidence_bundle     jsonb not null,
  provider_provenance jsonb,
  recorded_at         timestamptz not null default now(),
  constraint assessment_failure_handoff_code_check check (
    failure_code in (
      'timeout', 'provider_unavailable', 'invalid_output', 'unknown_evidence_reference'
    )
  ),
  -- The evidence bundle is the validated synthetic series and findings; a
  -- non-object, an empty series or a missing finding list is never a valid one.
  constraint assessment_failure_handoff_evidence_check check (
    jsonb_typeof(evidence_bundle) = 'object'
    and jsonb_typeof(evidence_bundle -> 'periods') = 'array'
    and jsonb_array_length(evidence_bundle -> 'periods') >= 1
    and jsonb_typeof(evidence_bundle -> 'findings') = 'array'
  ),
  constraint assessment_failure_handoff_provenance_check check (
    provider_provenance is null or jsonb_typeof(provider_provenance) = 'object'
  )
);

-- Access control: RLS enabled and grants set explicitly in this same migration
-- so no default anon/authenticated grant ever survives even transiently. The API
-- is the only writer and connects as service_role. Zero policies means every
-- non-bypass role is denied by default.
alter table public.assessment_failure_handoff enable row level security;

revoke all on public.assessment_failure_handoff from anon, authenticated;

grant select, insert on public.assessment_failure_handoff to service_role;

-- One atomic command boundary for the handoff: it serializes competing attempts
-- per application so a retry is a replay and a competing correlation is a
-- conflict, never a second record or a duplicated transition.
create or replace function public.record_assessment_failure_handoff(
  p_application_id uuid,
  p_correlation_id uuid,
  p_failure_code text,
  p_evidence_bundle jsonb,
  p_provider_provenance jsonb
)
returns table (
  result_kind text,
  application_id uuid,
  correlation_id uuid,
  failure_code text,
  evidence_bundle jsonb,
  provider_provenance jsonb,
  recorded_at timestamptz,
  actual_state text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.assessment_failure_handoff%rowtype;
  v_inserted public.assessment_failure_handoff%rowtype;
  v_actual_state text;
begin
  -- Serialize reuse of the same application so concurrent attempts resolve to the
  -- same replay/conflict outcome instead of racing the primary key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_application_id::text, 0)
  );

  select afh.*
    into v_existing
    from public.assessment_failure_handoff as afh
   where afh.application_id = p_application_id;

  if found then
    if v_existing.correlation_id = p_correlation_id then
      return query select
        'replayed'::text,
        v_existing.application_id,
        v_existing.correlation_id,
        v_existing.failure_code,
        v_existing.evidence_bundle,
        v_existing.provider_provenance,
        v_existing.recorded_at,
        null::text;
    else
      return query select
        'correlation_conflict'::text,
        v_existing.application_id,
        v_existing.correlation_id,
        v_existing.failure_code,
        v_existing.evidence_bundle,
        v_existing.provider_provenance,
        v_existing.recorded_at,
        null::text;
    end if;
    return;
  end if;

  -- A brand-new handoff is only meaningful while the application still awaits its
  -- assessment. Anything else is an incompatible state, reported with the actual
  -- state so the caller can tell the two conflicts apart.
  select ar.state
    into v_actual_state
    from public.application_review as ar
   where ar.application_id = p_application_id;

  if not found then
    return query select
      'not_found'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::jsonb,
      null::jsonb,
      null::timestamptz,
      null::text;
    return;
  end if;

  if v_actual_state <> 'awaiting_assessment' then
    return query select
      'state_conflict'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::jsonb,
      null::jsonb,
      null::timestamptz,
      v_actual_state;
    return;
  end if;

  insert into public.assessment_failure_handoff (
    application_id,
    correlation_id,
    failure_code,
    evidence_bundle,
    provider_provenance
  ) values (
    p_application_id,
    p_correlation_id,
    p_failure_code,
    p_evidence_bundle,
    p_provider_provenance
  )
  returning * into v_inserted;

  return query select
    'applied'::text,
    v_inserted.application_id,
    v_inserted.correlation_id,
    v_inserted.failure_code,
    v_inserted.evidence_bundle,
    v_inserted.provider_provenance,
    v_inserted.recorded_at,
    null::text;
end;
$$;

revoke execute on function public.record_assessment_failure_handoff(
  uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.record_assessment_failure_handoff(
  uuid, uuid, text, jsonb, jsonb
) to service_role;
