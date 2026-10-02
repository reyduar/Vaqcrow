-- Require a display name at signup; never derive it from the email
-- (Task #379, owner decision D3, 2026-10-02).
--
-- Why: the signup form asks for "Nombre completo" (INVERSOR) or "Nombre o Razón
-- Social" (PYME), and the email must never become a displayed name. The
-- previous versions of `handle_new_user()` and `promote_admin_on_app_metadata()`
-- fell back to the email local part (and then to 'user') when no display name
-- was given. Both functions now reject a missing display name, or one shorter
-- than 2 characters after trimming, with SQLSTATE 22023; the auth.users insert
-- (or update) is rolled back, so no profile row is created.
--
-- Everything else is unchanged: SECURITY DEFINER, empty search_path, the role
-- logic (public signup can only create PYME or INVERSOR; ADMIN only through the
-- service-role-only app_metadata), username handling, left(..., 120), and the
-- EXECUTE revokes. The triggers are not touched; `create or replace` keeps them
-- bound to the same functions.
--
-- The super admin seed is unaffected: GoTrue's admin createUser inserts with
-- `user_metadata { role: INVERSOR, display_name }` and then updates app_metadata
-- with a display name, so both steps carry a valid name.
--
-- Reversal: re-run the function bodies from
-- 20260930180000_create_identity_and_audit.sql and
-- 20261001120000_promote_admin_on_app_metadata.sql.

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

  if v_display_name is null or char_length(v_display_name) < 2 then
    raise exception 'display name is required (at least 2 characters)'
      using errcode = '22023';
  end if;

  insert into public.profile (user_id, role, display_name, username)
  values (new.id, v_role, left(v_display_name, 120), v_username);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

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

  -- A display name shorter than 2 characters counts as none: an existing
  -- profile keeps its own name, and creating a missing profile is rejected.
  if char_length(v_display_name) < 2 then
    v_display_name := null;
  end if;

  -- Existing profile: promote it in place, keeping its name and username when
  -- app_metadata gives none.
  update public.profile
    set role = 'ADMIN',
        display_name = coalesce(left(v_display_name, 120), profile.display_name),
        username = coalesce(v_username, profile.username),
        updated_at = now()
    where user_id = new.id;

  if found then
    return new;
  end if;

  -- Missing profile: it can only be created with a valid display name.
  if v_display_name is null then
    raise exception 'display name is required (at least 2 characters)'
      using errcode = '22023';
  end if;

  -- The on-conflict branch only covers a profile created concurrently.
  insert into public.profile (user_id, role, display_name, username)
  values (new.id, 'ADMIN', left(v_display_name, 120), v_username)
  on conflict (user_id) do update
    set role = 'ADMIN',
        display_name = coalesce(left(v_display_name, 120), profile.display_name),
        username = coalesce(v_username, profile.username),
        updated_at = now();

  return new;
end;
$$;

revoke execute on function public.promote_admin_on_app_metadata() from public, anon, authenticated;
