create table if not exists public.fx_rate (
  version bigint primary key check (version > 0),
  effective_at timestamptz not null,
  author_user_id uuid not null references auth.users(id),
  source text not null check (source in ('manual', 'provider')),
  usd_to_ars bigint not null check (usd_to_ars > 0),
  stroops_per_usd bigint not null check (stroops_per_usd > 0),
  created_at timestamptz not null default now()
);
create index if not exists fx_rate_current_idx on public.fx_rate (effective_at desc, version desc);
alter table public.fx_rate enable row level security;
revoke all on public.fx_rate from anon, authenticated, service_role;
grant select, insert on public.fx_rate to service_role;
