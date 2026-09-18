-- Create application_review table: durable state for the six-state
-- application review lifecycle (Feature #12), keyed by application_id.
create table if not exists public.application_review (
  application_id      uuid primary key,
  state                text not null,
  last_correlation_id uuid not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint application_review_state_check check (state in (
    'draft', 'awaiting_assessment', 'human_review',
    'approved', 'changes_requested', 'rejected'))
);

-- Maintain updated_at server-side; the API never supplies it directly.
-- SECURITY INVOKER (the default) so the trigger runs with the caller's
-- privileges, never escalating access.
create or replace function public.set_application_review_updated_at()
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

drop trigger if exists application_review_set_updated_at on public.application_review;

create trigger application_review_set_updated_at
  before update on public.application_review
  for each row
  execute function public.set_application_review_updated_at();

-- Access control: RLS enabled and grants set explicitly in this same
-- migration so no default anon/authenticated CRUD grant ever survives.
-- The API is the only writer and connects as service_role, which bypasses
-- RLS entirely. Zero policies here means every non-bypass role is denied
-- by default. Real user-facing policies are deferred to #134.
alter table public.application_review enable row level security;

revoke all on public.application_review from anon, authenticated;

grant select, insert, update on public.application_review to service_role;
