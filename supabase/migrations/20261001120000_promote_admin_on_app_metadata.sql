-- Promote a profile to ADMIN when the service role grants the app_metadata role
-- (Feature #369, Task #370 / U1 and U3 fix).
--
-- Why: GoTrue's admin createUser INSERTs into auth.users first, WITHOUT the
-- caller's app_metadata, and only afterwards UPDATEs raw_app_meta_data. The
-- strict `on_auth_user_created` insert trigger therefore never sees
-- `app_metadata.role = 'ADMIN'` and rejects the user ("signup role must be PYME
-- or INVERSOR"), so the super admin seed could not run.
--
-- The insert trigger stays strict and unchanged (public signup can only ever
-- create PYME or INVERSOR). This migration adds an `after update of
-- raw_app_meta_data` trigger that promotes the profile when the role transitions
-- to ADMIN. Only the service role can write app_metadata (it is not
-- user-editable, unlike user_metadata), so a client can never self-trigger this
-- promotion. The function is SECURITY DEFINER with an empty search_path and
-- EXECUTE revoked from every API role.
--
-- Reversal (no data outside this feature depends on it):
--   drop trigger if exists on_auth_user_app_metadata_updated on auth.users;
--   drop function if exists public.promote_admin_on_app_metadata();
create or replace function public.promote_admin_on_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_username text;
begin
  if new.raw_app_meta_data ->> 'role' is distinct from 'ADMIN'
     or coalesce(old.raw_app_meta_data ->> 'role', '') = 'ADMIN' then
    return new;
  end if;

  v_display_name := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'display_name', '')), '');
  v_username := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'username', '')), '');

  -- Upsert: promotes the existing profile, or creates one if it is missing.
  insert into public.profile (user_id, role, display_name, username)
  values (
    new.id,
    'ADMIN',
    left(
      coalesce(v_display_name, nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''), 'user'),
      120
    ),
    v_username
  )
  on conflict (user_id) do update
    set role = 'ADMIN',
        display_name = coalesce(left(v_display_name, 120), profile.display_name),
        username = coalesce(v_username, profile.username),
        updated_at = now();

  return new;
end;
$$;

revoke execute on function public.promote_admin_on_app_metadata() from public, anon, authenticated;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function public.promote_admin_on_app_metadata();
