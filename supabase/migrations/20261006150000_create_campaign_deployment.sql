-- Campaign vault deployment lifecycle (Feature #410, Task #410 / T5b).
--
-- One row per application records what happened after an admin approved it:
-- `pending` the moment the approval is recorded, `deploying` while the platform
-- signs and submits `factory.deploy`, `confirmed` once Testnet reports the
-- vault — and only then is the campaign published — or `failed` with a
-- sanitized code so the admin can retry from the review console. The row is the
-- durable idempotency anchor for the deploy, independent of the campaign
-- mirror: a confirmed deployment is what makes a replay a no-op.
--
-- `last_error` stores a code the API controls (for example `rate_unavailable`),
-- never provider text or an exception message. `campaign_id` is the mirrored
-- campaign the confirmation created; it is deliberately a plain uuid and not a
-- foreign key, because this row must survive even if a mirror row is reconciled
-- or cleaned up later.
--
-- RLS is enabled with zero policies and the grants are set explicitly in this
-- same migration, so no default anon/authenticated access ever survives even
-- transiently: the API connects as `service_role` (which bypasses RLS) and may
-- select, insert and update — never delete — a deployment row.
--
-- Reversal:
--   drop trigger if exists campaign_deployment_set_updated_at on public.campaign_deployment;
--   drop function if exists public.set_campaign_deployment_updated_at();
--   drop table if exists public.campaign_deployment;

create table if not exists public.campaign_deployment (
  application_id      uuid primary key references public.application_review(application_id) on delete restrict,
  state               text not null check (state in ('pending', 'deploying', 'confirmed', 'failed')),
  attempts            int not null default 0 check (attempts >= 0),
  last_error          text,
  campaign_id         uuid,
  last_correlation_id uuid not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Maintain updated_at server-side; the API never supplies it directly.
-- SECURITY INVOKER (the default) so the trigger runs with the caller's
-- privileges, never escalating access; search_path is pinned empty.
create or replace function public.set_campaign_deployment_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaign_deployment_set_updated_at on public.campaign_deployment;

create trigger campaign_deployment_set_updated_at
  before update on public.campaign_deployment
  for each row
  execute function public.set_campaign_deployment_updated_at();

alter table public.campaign_deployment enable row level security;

revoke all on public.campaign_deployment from anon, authenticated, service_role;

grant select, insert, update on public.campaign_deployment to service_role;

-- The trigger function is infrastructure, not an API surface: no role may call
-- it directly. The API keeps only the table grants above.
revoke execute on function public.set_campaign_deployment_updated_at() from public, anon, authenticated;
