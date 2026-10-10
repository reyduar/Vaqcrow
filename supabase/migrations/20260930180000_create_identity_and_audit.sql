-- Identity profile, signup role trigger and append-only audit log
-- (Feature #369, Task #370 / U1).
--
-- `public.profile` binds every Supabase Auth user to exactly one role
-- (PYME, INVERSOR, ADMIN), a display name, an optional unique username and an
-- active/inactive status. The API reads it to authorize each request.
--
-- The role is decided by the `after insert on auth.users` trigger below, never
-- by the client afterwards:
--   * `raw_app_meta_data.role = 'ADMIN'` creates an ADMIN profile. Only the
--     service role can write app_metadata, so this is the seed/invitation path.
--   * Otherwise `raw_user_meta_data.role` MUST be PYME or INVERSOR. user_metadata
--     is user-editable, so ADMIN there (or a missing role) raises and the signup
--     fails atomically.
--
-- `public.audit_log` is append-only: the API role gets SELECT + INSERT only.
--
-- `application_review` and `human_decision` grants are intentionally untouched
-- (they stay service_role only; see tests/rls-grants-containment.test.ts).
--
-- Reversal (no data outside this feature depends on it):
--   drop table if exists public.audit_log;
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--   drop table if exists public.profile;
create table public.profile (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null,
  display_name text not null,
  username     text,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profile_role_check check (role in ('PYME', 'INVERSOR', 'ADMIN')),
  constraint profile_display_name_check check (char_length(btrim(display_name)) between 1 and 120),
  constraint profile_username_key unique (username),
  constraint profile_username_check check (
    username is null
    or (username = lower(username) and char_length(username) between 3 and 40 and username ~ '^[a-z0-9._-]+$')
  ),
  constraint profile_status_check check (status in ('active', 'inactive'))
);

create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid not null references public.profile(user_id),
  action         text not null,
  target_type    text not null,
  target_id      text not null,
  detail         jsonb not null default '{}'::jsonb,
  correlation_id uuid,
  created_at     timestamptz not null default now(),
  constraint audit_log_action_check check (char_length(action) between 1 and 80 and action ~ '^[a-z_.]+$'),
  constraint audit_log_target_type_check check (char_length(target_type) between 1 and 40),
  constraint audit_log_target_id_check check (char_length(target_id) between 1 and 120)
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
-- Backs the actor foreign key (no scan on profile maintenance).
create index audit_log_actor_user_id_idx on public.audit_log (actor_user_id);

-- Access control: RLS enabled and grants set explicitly in this same migration
-- so no default anon/authenticated grant ever survives even transiently.
alter table public.profile enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profile from anon, authenticated, service_role;
revoke all on public.audit_log from anon, authenticated, service_role;

-- The API (service_role) manages profiles; a profile is never deleted directly
-- (it goes with its auth user via the cascade).
grant select, insert, update on public.profile to service_role;
-- Append-only: no update/delete for any role.
grant select, insert on public.audit_log to service_role;

-- A signed-in user can read only their own profile. No write grant at all.
grant select on public.profile to authenticated;

create policy profile_select_own on public.profile
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Signup trigger. SECURITY DEFINER is required: it runs inside the Auth
-- service's insert on auth.users and writes to a table the caller cannot touch.
-- search_path is pinned empty and EXECUTE is revoked from every API role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_display_name text;
  v_username text;
begin
  if new.raw_app_meta_data ->> 'role' = 'ADMIN' then
    v_role := 'ADMIN';
    v_display_name := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'display_name', '')), '');
    v_username := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'username', '')), '');
  else
    v_role := new.raw_user_meta_data ->> 'role';
    if v_role is null or v_role not in ('PYME', 'INVERSOR') then
      raise exception 'signup role must be PYME or INVERSOR'
        using errcode = '22023';
    end if;
    v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  end if;

  if v_display_name is null then
    v_display_name := nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '');
  end if;

  insert into public.profile (user_id, role, display_name, username)
  values (new.id, v_role, left(coalesce(v_display_name, 'user'), 120), v_username);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
