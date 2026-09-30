-- Persist the SME financing request and create its application atomically
-- (Feature #30, Task #95 / T2a). The request is the first step of the demo
-- journey: submitting it creates the `application_review` row in
-- `awaiting_assessment` and returns the application id every later step
-- (assessment, human decision, campaign, distribution, evidence) consumes.
--
-- The SME public key is deliberately NOT part of the request: it is captured
-- when the campaign vault opens (`20260924132528_add_campaign_sme_account.sql`).
--
-- Reversal (no data outside this feature depends on it):
--   drop function if exists public.submit_sme_request(uuid, uuid, text, numeric, text, text);
--   drop table if exists public.sme_request;
create table public.sme_request (
  application_id     uuid primary key
    references public.application_review(application_id) on delete cascade,
  sme_reference      text not null,
  declared_total_ars numeric not null,
  period_start       text not null,
  period_end         text not null,
  correlation_id     uuid not null,
  created_at         timestamptz not null default now(),
  -- One application per submission: a replay of the same correlation id is
  -- resolved by the function below, and this constraint is the backstop.
  constraint sme_request_correlation_id_key unique (correlation_id),
  constraint sme_request_reference_check check (length(sme_reference) > 0),
  constraint sme_request_total_check check (declared_total_ars >= 0),
  constraint sme_request_period_start_check check (period_start ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint sme_request_period_end_check check (period_end ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint sme_request_period_order_check check (period_start <= period_end)
);

-- Access control: RLS enabled and grants set explicitly in this same migration
-- so no default anon/authenticated grant ever survives even transiently. The API
-- is the only writer and connects as service_role. Zero policies means every
-- non-bypass role is denied by default.
--
-- Supabase grants service_role broad privileges on new tables by default, so
-- revoking from anon/authenticated alone would leave a submitted request
-- mutable through the service role (see
-- 20260919203900_enforce_human_decision_grant_immutability.sql). A request is
-- immutable once submitted: the API role gets SELECT + INSERT only.
alter table public.sme_request enable row level security;

revoke all on public.sme_request from anon, authenticated, service_role;

grant select, insert on public.sme_request to service_role;

-- One atomic command boundary: the application row and the request row are
-- created in the same transaction, or not at all. It serializes on the
-- correlation id so a retry is a replay that returns the application the first
-- attempt created, never a second application.
create or replace function public.submit_sme_request(
  p_application_id uuid,
  p_correlation_id uuid,
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
    period_end
  ) values (
    p_application_id,
    p_correlation_id,
    p_sme_reference,
    p_declared_total_ars,
    p_period_start,
    p_period_end
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
  uuid, uuid, text, numeric, text, text
) from public, anon, authenticated;

grant execute on function public.submit_sme_request(
  uuid, uuid, text, numeric, text, text
) to service_role;
