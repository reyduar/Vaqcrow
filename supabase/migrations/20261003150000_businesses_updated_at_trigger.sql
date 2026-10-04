-- Maintain `businesses.updated_at` server-side (Feature #398, Task #399 / T3b,
-- review finding R3-001). The column has a `default now()` but nothing refreshed
-- it on UPDATE, so a row's `updated_at` froze at insert. This migration adds the
-- same trigger pattern the other persisted aggregates use.
--
-- SECURITY INVOKER (the default) so the trigger runs with the caller's
-- privileges, never escalating access; `search_path` is pinned empty.
--
-- Reversal:
--   drop trigger if exists businesses_set_updated_at on public.businesses;
--   drop function if exists public.set_businesses_updated_at();

create or replace function public.set_businesses_updated_at()
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

drop trigger if exists businesses_set_updated_at on public.businesses;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row
  execute function public.set_businesses_updated_at();

-- The trigger function is infrastructure, not an API surface: no role may call
-- it directly. The API keeps only the table grants the first migration set.
revoke execute on function public.set_businesses_updated_at() from public, anon, authenticated;
