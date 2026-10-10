-- Make the owner+content submission idempotency atomic (Feature #402, RDD R3-1).
--
-- The use case reads the owner's requests (`findByOwner`) and then calls this
-- RPC. That read-then-write pair is not atomic: two concurrent retries from the
-- same owner carrying identical declared content can both observe no existing
-- row and each insert a separate application. This function now performs the
-- owner+content check inside its own transaction, under a transaction-scoped
-- advisory lock keyed on the owner, so a concurrent pair is serialized and the
-- second call replays instead of inserting again.
--
-- The correlation-id lock is kept: it preserves the original per-transport
-- replay guarantee and stops two same-correlation calls from racing the
-- `sme_request_correlation_id_key` unique constraint. Both locks are taken in
-- the same order (owner first, then correlation) by every caller, so the
-- ordering cannot deadlock.
--
-- No unique constraint is added on (owner, content): that would forbid a
-- legitimate future same-content resubmission. The advisory lock serializes the
-- check without constraining the data, so the policy stays changeable.
--
-- Reversal: recreate the function from
-- `20261003160000_submit_sme_request_owner.sql`.

create or replace function public.submit_sme_request(
  p_application_id uuid,
  p_correlation_id uuid,
  p_owner_user_id uuid,
  p_sme_reference text,
  p_declared_total_ars numeric,
  p_period_start text,
  p_period_end text
)
returns table (
  result_kind text,
  application_id uuid,
  sme_reference text,
  declared_total_ars numeric,
  period_start text,
  period_end text,
  correlation_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.sme_request%rowtype;
begin
  -- Serialize every submission by the same owner. A concurrent retry waits here
  -- instead of reading no existing row and inserting a duplicate. `hashtext`
  -- returns int4, which resolves to the bigint overload of the lock function;
  -- the lock is released at commit or rollback.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_owner_user_id::text)
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_correlation_id::text, 0)
  );

  -- Replay of a retried transport request: same correlation id.
  select sr.*
    into v_existing
    from public.sme_request as sr
   where sr.correlation_id = p_correlation_id;

  if found then
    return query select
      'replayed'::text,
      v_existing.application_id,
      v_existing.sme_reference,
      v_existing.declared_total_ars,
      v_existing.period_start,
      v_existing.period_end,
      v_existing.correlation_id;
    return;
  end if;

  -- A retry with a fresh correlation id but identical declared content is the
  -- same submission. The owner lock above makes this read race-free: no
  -- concurrent same-owner submission can insert between the read and the insert.
  select sr.*
    into v_existing
    from public.sme_request as sr
   where sr.owner_user_id = p_owner_user_id
     and sr.sme_reference = p_sme_reference
     and sr.declared_total_ars = p_declared_total_ars
     and sr.period_start = p_period_start
     and sr.period_end = p_period_end
   order by sr.created_at
   limit 1;

  if found then
    return query select
      'replayed'::text,
      v_existing.application_id,
      v_existing.sme_reference,
      v_existing.declared_total_ars,
      v_existing.period_start,
      v_existing.period_end,
      v_existing.correlation_id;
    return;
  end if;

  insert into public.application_review (application_id, state, last_correlation_id)
  values (p_application_id, 'awaiting_assessment', p_correlation_id);

  insert into public.sme_request (
    application_id,
    correlation_id,
    sme_reference,
    declared_total_ars,
    period_start,
    period_end,
    owner_user_id
  ) values (
    p_application_id,
    p_correlation_id,
    p_sme_reference,
    p_declared_total_ars,
    p_period_start,
    p_period_end,
    p_owner_user_id
  );

  return query select
    'applied'::text,
    p_application_id,
    p_sme_reference,
    p_declared_total_ars,
    p_period_start,
    p_period_end,
    p_correlation_id;
end;
$$;

revoke execute on function public.submit_sme_request(
  uuid, uuid, uuid, text, numeric, text, text
) from public, anon, authenticated;

grant execute on function public.submit_sme_request(
  uuid, uuid, uuid, text, numeric, text, text
) to service_role;
