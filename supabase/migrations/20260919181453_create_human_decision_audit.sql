-- Persist immutable human decisions and expose one atomic command boundary for
-- idempotency, application state transition, and audit insertion.
create table public.human_decision (
  decision_id       uuid primary key,
  application_id    uuid not null references public.application_review(application_id),
  outcome           text not null,
  actor             text not null,
  reason            text not null,
  approved_limit_ars bigint,
  decided_at        timestamptz not null default now(),
  correlation_id    uuid not null,
  constraint human_decision_outcome_check check (
    outcome in ('approved', 'changes_requested', 'rejected')
  ),
  constraint human_decision_actor_check check (
    char_length(btrim(actor)) > 0 and char_length(actor) <= 120
  ),
  constraint human_decision_reason_check check (
    char_length(btrim(reason)) > 0 and char_length(reason) <= 1000
  ),
  constraint human_decision_approved_limit_check check (
    (outcome = 'approved' and approved_limit_ars > 0)
    or
    (outcome in ('changes_requested', 'rejected') and approved_limit_ars is null)
  )
);

create index human_decision_application_id_idx
  on public.human_decision (application_id);

alter table public.human_decision enable row level security;

revoke all on public.human_decision from anon, authenticated;
grant select, insert on public.human_decision to service_role;

create or replace function public.record_human_decision(
  p_decision_id uuid,
  p_application_id uuid,
  p_outcome text,
  p_actor text,
  p_reason text,
  p_approved_limit_ars bigint,
  p_correlation_id uuid
)
returns table (
  result_kind text,
  decision_id uuid,
  application_id uuid,
  outcome text,
  actor text,
  reason text,
  approved_limit_ars bigint,
  decided_at timestamptz,
  correlation_id uuid,
  actual_state text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.human_decision%rowtype;
  v_inserted public.human_decision%rowtype;
  v_actual_state text;
begin
  -- Serialize reuse of the same id so concurrent requests produce the same
  -- replay/conflict semantics instead of leaking a unique-violation race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_decision_id::text, 0)
  );

  select hd.*
    into v_existing
    from public.human_decision as hd
   where hd.decision_id = p_decision_id;

  if found then
    if row(
      v_existing.application_id,
      v_existing.outcome,
      v_existing.actor,
      v_existing.reason,
      v_existing.approved_limit_ars
    ) is not distinct from row(
      p_application_id,
      p_outcome,
      p_actor,
      p_reason,
      p_approved_limit_ars
    ) then
      return query select
        'replayed'::text,
        v_existing.decision_id,
        v_existing.application_id,
        v_existing.outcome,
        v_existing.actor,
        v_existing.reason,
        v_existing.approved_limit_ars,
        v_existing.decided_at,
        v_existing.correlation_id,
        null::text;
    else
      return query select
        'idempotency_conflict'::text,
        v_existing.decision_id,
        v_existing.application_id,
        v_existing.outcome,
        v_existing.actor,
        v_existing.reason,
        v_existing.approved_limit_ars,
        v_existing.decided_at,
        v_existing.correlation_id,
        null::text;
    end if;
    return;
  end if;

  update public.application_review as ar
     set state = p_outcome,
         last_correlation_id = p_correlation_id
   where ar.application_id = p_application_id
     and ar.state = 'human_review'
  returning ar.state into v_actual_state;

  if not found then
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
        null::text,
        null::text,
        null::bigint,
        null::timestamptz,
        null::uuid,
        null::text;
    else
      return query select
        'state_conflict'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::text,
        null::text,
        null::bigint,
        null::timestamptz,
        null::uuid,
        v_actual_state;
    end if;
    return;
  end if;

  insert into public.human_decision (
    decision_id,
    application_id,
    outcome,
    actor,
    reason,
    approved_limit_ars,
    correlation_id
  ) values (
    p_decision_id,
    p_application_id,
    p_outcome,
    p_actor,
    p_reason,
    p_approved_limit_ars,
    p_correlation_id
  )
  returning * into v_inserted;

  return query select
    'applied'::text,
    v_inserted.decision_id,
    v_inserted.application_id,
    v_inserted.outcome,
    v_inserted.actor,
    v_inserted.reason,
    v_inserted.approved_limit_ars,
    v_inserted.decided_at,
    v_inserted.correlation_id,
    null::text;
end;
$$;

revoke execute on function public.record_human_decision(
  uuid, uuid, text, text, text, bigint, uuid
) from public, anon, authenticated;

grant execute on function public.record_human_decision(
  uuid, uuid, text, text, text, bigint, uuid
) to service_role;
