-- Per-document KYC/KYB verdicts in the admin review (Feature #410, U1, D8).
--
-- One row per (application, document) holds the CURRENT verdict an admin set on
-- that document in the review console: `valid`, `request` (ask the PyME for it
-- again) or `invalid`. The row is overwritten in place when an admin changes the
-- verdict; it is not a history log. `actor` is the authenticated admin's display
-- name and `actor_user_id` their user id, both taken by the API from the
-- verified principal, never from a request body.
--
-- Both foreign keys are `on delete restrict`: a verdict an admin recorded must
-- not silently disappear because its application or document was removed.
-- `actor_user_id` is deliberately a plain uuid and not a foreign key to
-- profile, so the attribution survives a later change to the admin's account.
--
-- RLS is enabled with zero policies and the grants are set explicitly in this
-- same migration, so no default anon/authenticated access ever survives even
-- transiently: the API connects as `service_role` (which bypasses RLS) and may
-- select, insert and update — never delete — a verdict row.
--
-- Reversal:
--   drop trigger if exists document_verdict_set_updated_at on public.document_verdict;
--   drop function if exists public.set_document_verdict_updated_at();
--   drop table if exists public.document_verdict;

create table if not exists public.document_verdict (
  application_id  uuid not null references public.application_review(application_id) on delete restrict,
  document_id     uuid not null references public.pyme_document(id) on delete restrict,
  verdict         text not null check (verdict in ('valid', 'request', 'invalid')),
  actor           text not null check (length(btrim(actor)) between 1 and 120),
  actor_user_id   uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (application_id, document_id)
);

-- The primary key leads with application_id (the per-application listing the
-- review context issues); this index backs the document foreign key so a
-- pyme_document delete check never scans the table.
create index if not exists document_verdict_document_id_idx on public.document_verdict (document_id);

-- Maintain updated_at server-side; the API never supplies it directly.
-- SECURITY INVOKER (the default) so the trigger runs with the caller's
-- privileges, never escalating access; search_path is pinned empty.
create or replace function public.set_document_verdict_updated_at()
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

drop trigger if exists document_verdict_set_updated_at on public.document_verdict;

create trigger document_verdict_set_updated_at
  before update on public.document_verdict
  for each row
  execute function public.set_document_verdict_updated_at();

alter table public.document_verdict enable row level security;

revoke all on public.document_verdict from public, anon, authenticated, service_role;

grant select, insert, update on public.document_verdict to service_role;

-- The trigger function is infrastructure, not an API surface: no role may call
-- it directly. The API keeps only the table grants above.
revoke execute on function public.set_document_verdict_updated_at() from public, anon, authenticated;
