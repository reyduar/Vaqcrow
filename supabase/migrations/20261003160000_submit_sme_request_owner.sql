-- Record the request's owner at submit time (Feature #398, Task #399 / T3b,
-- resolving R1-002). The wizard submits as the authenticated PyME, so the
-- request must carry `owner_user_id` from the verified principal. The API
-- supplies it; a client never does.
--
-- `submit_sme_request` changes signature to accept the owner. The old
-- six-argument function is dropped so only one overload survives (the API always
-- calls the new one) and its grants do not linger.
--
-- Reversal: recreate the six-argument function from
-- `20260930130000_create_sme_request.sql` and drop this one:
--   drop function if exists public.submit_sme_request(uuid, uuid, uuid, text, numeric, text, text);

drop function if exists public.submit_sme_request(uuid, uuid, text, numeric, text, text);

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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_correlation_id::text, 0)
  );

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
