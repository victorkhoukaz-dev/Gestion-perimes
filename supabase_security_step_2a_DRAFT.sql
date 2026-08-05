-- =============================================================================
-- PHARMAOPS - SECURITY STEP 2A (REVIEW DRAFT ONLY)
-- =============================================================================
-- STATUS: DO NOT RUN YET.
--
-- This draft removes authorization decisions from editable Auth user metadata
-- and prevents a signed-in user from changing their own pharmacy or role.
--
-- PREREQUISITE:
--   App/index.html must first be changed to use controlled database functions
--   for "create pharmacy" and "join pharmacy". The current registration flow
--   writes pharmacy_id and role directly, so applying this SQL first would
--   intentionally make the current registration flow fail.
--
-- No application rows are deleted by this script.
-- =============================================================================

begin;

-- Deliberate safety stop while this file is still a draft.
-- Remove this block only after the matching application change is reviewed.
do $$
begin
  raise exception
    'DRAFT ONLY: update the PharmaOps registration flow before applying Step 2A';
end;
$$;

-- Everything below is unreachable until the safety stop above is removed.

-- -----------------------------------------------------------------------------
-- 1. New Auth users receive a neutral, unassigned profile.
--
-- raw_user_meta_data remains suitable for non-security display information such
-- as initials. It must never decide pharmacy membership or authorization role.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, pharmacy_id, initials, role)
  values (
    new.id,
    new.email,
    null,
    left(upper(coalesce(new.raw_user_meta_data ->> 'initials', 'N/A')), 4),
    'tech'
  )
  on conflict (id) do update
  set email = excluded.email,
      initials = excluded.initials;

  return new;
end;
$$;

-- A trigger function is invoked by the auth.users trigger, not through the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Remove direct profile creation from the browser.
--
-- Profile creation is owned by handle_new_user(). A later controlled function
-- will assign pharmacy_id after validating a join code or creating a pharmacy.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_insert_own on public.profiles;

-- -----------------------------------------------------------------------------
-- 3. A user may update only their own non-security profile fields.
--
-- RLS controls rows. Column grants independently prevent browser clients from
-- updating pharmacy_id, role, id, or email through the Data API.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own_safe
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke update on table public.profiles from authenticated;
grant update (initials) on table public.profiles to authenticated;

-- Keep the read access needed by the authenticated application.
grant select on table public.profiles to authenticated;

commit;

-- =============================================================================
-- REVIEW / TEST QUERIES (run only after the migration succeeds)
-- =============================================================================
-- 1. Confirm the signup trigger function no longer reads pharmacy_id or role:
-- select pg_get_functiondef('public.handle_new_user()'::regprocedure);
--
-- 2. Confirm direct INSERT is denied and UPDATE is limited to initials:
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'profiles'
--   and grantee in ('anon', 'authenticated')
-- order by grantee, privilege_type;
--
-- select grantee, privilege_type, column_name
-- from information_schema.column_privileges
-- where table_schema = 'public'
--   and table_name = 'profiles'
--   and grantee = 'authenticated'
-- order by privilege_type, column_name;
--
-- 3. Required behavioral tests with two test pharmacies:
--    - User A can update only their own initials.
--    - User A cannot change pharmacy_id, role, id, or email.
--    - User A cannot insert another profile.
--    - A new signup receives role=tech and pharmacy_id=NULL.
--    - User A cannot view profiles belonging to Pharmacy B.
-- =============================================================================
