-- =============================================================================
-- PHARMAOPS - MIGRATION + PRODUCTION ROLLBACK REHEARSAL (ROLLBACK ONLY)
-- =============================================================================
-- STATUS: LOCAL REVIEW CANDIDATE - DO NOT CHANGE THE FINAL ROLLBACK TO COMMIT.
--
-- This harness:
--   1. Applies the production security migration candidate in one transaction.
--   2. Applies the emergency production rollback in the same transaction.
--   3. Runs both scripts' identity, structure, and row-count checks.
--   4. Ends with ROLLBACK so the live schema and data remain unchanged.
-- =============================================================================

begin;

-- Avoid waiting indefinitely if normal application activity holds a lock.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- -----------------------------------------------------------------------------
-- PRE-MIGRATION PRODUCTION IDENTITY GUARD
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from public.pharmacies
    where id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
      and trim(name) = 'PJC 28'
  ) then
    raise exception
      'SAFETY STOP: protected production pharmacy PJC 28 was not found';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = 'c37f945e-2c4d-4449-9268-d7e8848e7237'::uuid
      and pharmacy_id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
      and role = 'owner'
  ) then
    raise exception
      'SAFETY STOP: protected PJC 28 owner relationship does not match baseline';
  end if;

  -- The emergency rollback removes this schema without CASCADE. Refuse to
  -- proceed if it already exists and may contain unrelated application objects.
  if to_regnamespace('private') is not null then
    raise exception
      'SAFETY STOP: private schema already exists before this migration';
  end if;
end;
$$;

-- Record row counts inside this transaction. The postcheck aborts if this
-- security-only migration unexpectedly inserts, updates, or deletes app rows.
create temporary table pharmaops_security_pre_counts
on commit drop
as
select 'catalog'::text as table_name, count(*)::bigint as row_count from public.catalog
union all
select 'configurations', count(*) from public.configurations
union all
select 'flagged_products', count(*) from public.flagged_products
union all
select 'generics_purchases', count(*) from public.generics_purchases
union all
select 'pharmacies', count(*) from public.pharmacies
union all
select 'profiles', count(*) from public.profiles;

-- =============================================================================
-- CONSOLIDATED STEP 2A
-- =============================================================================
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
revoke update (id, pharmacy_id, email, initials, role, created_at)
on table public.profiles
from authenticated;
grant update (initials) on table public.profiles to authenticated;

-- Keep the read access needed by the authenticated application.
grant select on table public.profiles to authenticated;

-- =============================================================================
-- CONSOLIDATED STEP 2B
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. Create a pharmacy for the current user.
--
-- SECURITY DEFINER is required for this narrow operation because the function
-- must create the pharmacy and assign the caller atomically. The empty
-- search_path, schema-qualified relations, auth.uid() check, row lock, and
-- explicit EXECUTE grants constrain the elevated privilege.
-- -----------------------------------------------------------------------------
create or replace function public.create_pharmacy_for_current_user(
  p_pharmacy_name text,
  p_initials text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_pharmacy_id uuid;
  v_new_pharmacy_id uuid;
  v_name text := trim(p_pharmacy_name);
  v_initials text := left(upper(trim(coalesce(p_initials, ''))), 4);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'Pharmacy name must contain between 1 and 120 characters';
  end if;

  if v_initials = '' then
    raise exception 'Initials are required';
  end if;

  select pharmacy_id
  into v_existing_pharmacy_id
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Authenticated user profile was not found';
  end if;

  if v_existing_pharmacy_id is not null then
    raise exception 'This account is already assigned to a pharmacy';
  end if;

  insert into public.pharmacies (name)
  values (v_name)
  returning id into v_new_pharmacy_id;

  update public.profiles
  set pharmacy_id = v_new_pharmacy_id,
      role = 'owner',
      initials = v_initials
  where id = v_user_id;

  return v_new_pharmacy_id;
end;
$$;

revoke all on function public.create_pharmacy_for_current_user(text, text)
from public, anon, authenticated;
grant execute on function public.create_pharmacy_for_current_user(text, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Join an existing pharmacy using its exact code.
--
-- A joining user always receives the technician role. The caller cannot choose
-- owner/admin, cannot provide a pharmacy UUID, and cannot switch pharmacies.
-- -----------------------------------------------------------------------------
create or replace function public.join_pharmacy_for_current_user(
  p_pharmacy_code text,
  p_initials text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_pharmacy_id uuid;
  v_target_pharmacy_id uuid;
  v_code text := upper(trim(coalesce(p_pharmacy_code, '')));
  v_initials text := left(upper(trim(coalesce(p_initials, ''))), 4);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_code = '' or char_length(v_code) > 10 then
    raise exception 'Invalid pharmacy code';
  end if;

  if v_initials = '' then
    raise exception 'Initials are required';
  end if;

  select pharmacy_id
  into v_existing_pharmacy_id
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Authenticated user profile was not found';
  end if;

  if v_existing_pharmacy_id is not null then
    raise exception 'This account is already assigned to a pharmacy';
  end if;

  select id
  into v_target_pharmacy_id
  from public.pharmacies
  where code = v_code;

  if v_target_pharmacy_id is null then
    raise exception 'Invalid pharmacy code';
  end if;

  update public.profiles
  set pharmacy_id = v_target_pharmacy_id,
      role = 'tech',
      initials = v_initials
  where id = v_user_id;

  return v_target_pharmacy_id;
end;
$$;

revoke all on function public.join_pharmacy_for_current_user(text, text)
from public, anon, authenticated;
grant execute on function public.join_pharmacy_for_current_user(text, text)
to authenticated;

-- =============================================================================
-- CONSOLIDATED STEP 2C
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. Change another member's role within the caller's pharmacy.
-- -----------------------------------------------------------------------------
create or replace function public.set_pharmacy_member_role(
  p_member_id uuid,
  p_new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_pharmacy_id uuid;
  v_caller_role text;
  v_member_pharmacy_id uuid;
  v_new_role text := lower(trim(coalesce(p_new_role, '')));
begin
  if v_caller_id is null then
    raise exception 'Authentication required';
  end if;

  if p_member_id is null or p_member_id = v_caller_id then
    raise exception 'Owners cannot change their own role';
  end if;

  if v_new_role not in ('owner', 'tech') then
    raise exception 'Role must be owner or tech';
  end if;

  select pharmacy_id, role
  into v_caller_pharmacy_id, v_caller_role
  from public.profiles
  where id = v_caller_id;

  if not found or v_caller_pharmacy_id is null or v_caller_role <> 'owner' then
    raise exception 'Only a pharmacy owner may manage roles';
  end if;

  select pharmacy_id
  into v_member_pharmacy_id
  from public.profiles
  where id = p_member_id
  for update;

  if not found or v_member_pharmacy_id is distinct from v_caller_pharmacy_id then
    raise exception 'Member was not found in your pharmacy';
  end if;

  update public.profiles
  set role = v_new_role
  where id = p_member_id;
end;
$$;

revoke all on function public.set_pharmacy_member_role(uuid, text)
from public, anon, authenticated;
grant execute on function public.set_pharmacy_member_role(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Remove another member's pharmacy access without deleting their account.
--
-- RLS reads the profile membership on each database request, so setting
-- pharmacy_id to NULL immediately removes access to pharmacy-scoped rows.
-- -----------------------------------------------------------------------------
create or replace function public.remove_pharmacy_member(
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_pharmacy_id uuid;
  v_caller_role text;
  v_member_pharmacy_id uuid;
begin
  if v_caller_id is null then
    raise exception 'Authentication required';
  end if;

  if p_member_id is null or p_member_id = v_caller_id then
    raise exception 'Owners cannot remove themselves';
  end if;

  select pharmacy_id, role
  into v_caller_pharmacy_id, v_caller_role
  from public.profiles
  where id = v_caller_id;

  if not found or v_caller_pharmacy_id is null or v_caller_role <> 'owner' then
    raise exception 'Only a pharmacy owner may remove members';
  end if;

  select pharmacy_id
  into v_member_pharmacy_id
  from public.profiles
  where id = p_member_id
  for update;

  if not found or v_member_pharmacy_id is distinct from v_caller_pharmacy_id then
    raise exception 'Member was not found in your pharmacy';
  end if;

  update public.profiles
  set pharmacy_id = null,
      role = 'tech'
  where id = p_member_id;
end;
$$;

revoke all on function public.remove_pharmacy_member(uuid)
from public, anon, authenticated;
grant execute on function public.remove_pharmacy_member(uuid)
to authenticated;

-- Direct profile deletion is no longer part of team management.
drop policy if exists profiles_owner_delete on public.profiles;
revoke delete on table public.profiles from authenticated;

-- =============================================================================
-- CONSOLIDATED STEP 2D
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. A user may read only the pharmacy assigned to their trusted profile.
-- -----------------------------------------------------------------------------
-- Keep the SECURITY DEFINER RLS helper outside the exposed public API schema.
-- Authenticated users may execute it only as part of policy evaluation; the
-- private schema is not exposed through PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.my_pharmacy_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pharmacy_id
  from public.profiles
  where id = (select auth.uid())
$$;

revoke all on function private.my_pharmacy_id()
from public, anon, authenticated;
grant execute on function private.my_pharmacy_id() to authenticated;

create or replace function private.is_pharmacy_owner(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and pharmacy_id = p_pharmacy_id
      and role = 'owner'
  )
$$;

revoke all on function private.is_pharmacy_owner(uuid)
from public, anon, authenticated;
grant execute on function private.is_pharmacy_owner(uuid) to authenticated;

-- Preserve the legacy public function signature without leaving a privileged
-- public RPC. No API role receives EXECUTE on this compatibility wrapper.
create or replace function public.my_pharmacy_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select private.my_pharmacy_id()
$$;

revoke all on function public.my_pharmacy_id()
from public, anon, authenticated;

-- Recreate every legacy policy that depended on public.my_pharmacy_id().
drop policy if exists catalog_delete_own_pharmacy on public.catalog;
create policy catalog_delete_own_pharmacy
on public.catalog for delete to authenticated
using (pharmacy_id = private.my_pharmacy_id());

drop policy if exists catalog_update_own_pharmacy on public.catalog;
create policy catalog_update_own_pharmacy
on public.catalog for update to authenticated
using (pharmacy_id = private.my_pharmacy_id())
with check (pharmacy_id = private.my_pharmacy_id());

drop policy if exists catalog_write_own_pharmacy on public.catalog;
create policy catalog_write_own_pharmacy
on public.catalog for insert to authenticated
with check (pharmacy_id = private.my_pharmacy_id());

drop policy if exists configurations_own_pharmacy on public.configurations;
create policy configurations_own_pharmacy
on public.configurations to authenticated
using (pharmacy_id = private.my_pharmacy_id())
with check (pharmacy_id = private.my_pharmacy_id());

drop policy if exists flagged_products_own_pharmacy on public.flagged_products;
create policy flagged_products_own_pharmacy
on public.flagged_products to authenticated
using (pharmacy_id = private.my_pharmacy_id())
with check (pharmacy_id = private.my_pharmacy_id());

drop policy if exists profiles_select_same_pharmacy on public.profiles;
create policy profiles_select_same_pharmacy
on public.profiles for select to authenticated
using (pharmacy_id = private.my_pharmacy_id());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update
on public.profiles for update to authenticated
using (
  pharmacy_id = private.my_pharmacy_id()
  and private.is_pharmacy_owner(pharmacy_id)
)
with check (
  pharmacy_id = private.my_pharmacy_id()
  and private.is_pharmacy_owner(pharmacy_id)
);

drop policy if exists pharmacies_select_public on public.pharmacies;
drop policy if exists "Allow public select on pharmacies" on public.pharmacies;
drop policy if exists pharmacies_select_own on public.pharmacies;

create policy pharmacies_select_own
on public.pharmacies
for select
to authenticated
using (id = private.my_pharmacy_id());

revoke select on table public.pharmacies from public, anon;
grant select on table public.pharmacies to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Pharmacy creation is available only through the controlled Step 2B RPC.
-- -----------------------------------------------------------------------------
drop policy if exists pharmacies_insert_authenticated on public.pharmacies;
drop policy if exists "Permettre l'insertion Ã  l'inscription" on public.pharmacies;
drop policy if exists "Allow public insert to pharmacies" on public.pharmacies;

-- Remove every legacy INSERT policy without depending on an accented policy
-- name surviving file/database encoding identically.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select polname
    from pg_catalog.pg_policy
    where polrelid = 'public.pharmacies'::regclass
      and polcmd = 'a'
  loop
    execute format(
      'drop policy %I on public.pharmacies',
      v_policy.polname
    );
  end loop;
end;
$$;

revoke insert on table public.pharmacies from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Keep the caller's catalog private while allowing authenticated onboarding
--    to read the verified master catalog without querying pharmacies by name.
-- -----------------------------------------------------------------------------
drop policy if exists catalog_select_own_or_master on public.catalog;

create policy catalog_select_own_or_master
on public.catalog
for select
to authenticated
using (
  pharmacy_id = private.my_pharmacy_id()
  or pharmacy_id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
);

revoke select on table public.catalog from public, anon;
grant select on table public.catalog to authenticated;

-- =============================================================================
-- CONSOLIDATED STEP 2E
-- =============================================================================
alter table public.generics_purchases enable row level security;

drop policy if exists "Seul le propriÃ©taire peut lire les achats gÃ©nÃ©riques"
on public.generics_purchases;
drop policy if exists "Seul le propriÃ©taire peut Ã©crire les achats gÃ©nÃ©riques"
on public.generics_purchases;
drop policy if exists generics_purchases_select_own_pharmacy
on public.generics_purchases;
drop policy if exists generics_purchases_insert_own_pharmacy
on public.generics_purchases;
drop policy if exists generics_purchases_update_own_pharmacy
on public.generics_purchases;

-- Remove all remaining legacy policies without relying on their accented
-- French names matching the SQL file's text encoding.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select polname
    from pg_catalog.pg_policy
    where polrelid = 'public.generics_purchases'::regclass
  loop
    execute format(
      'drop policy %I on public.generics_purchases',
      v_policy.polname
    );
  end loop;
end;
$$;

create policy generics_purchases_select_own_pharmacy
on public.generics_purchases
for select
to authenticated
using (pharmacy_id = private.my_pharmacy_id());

create policy generics_purchases_insert_own_pharmacy
on public.generics_purchases
for insert
to authenticated
with check (
  pharmacy_id = private.my_pharmacy_id()
  and user_id = (select auth.uid())
);

create policy generics_purchases_update_own_pharmacy
on public.generics_purchases
for update
to authenticated
using (pharmacy_id = private.my_pharmacy_id())
with check (
  pharmacy_id = private.my_pharmacy_id()
  and user_id = (select auth.uid())
);

revoke all on table public.generics_purchases from public, anon;
revoke delete on table public.generics_purchases from authenticated;
grant select, insert, update on table public.generics_purchases to authenticated;

-- =============================================================================
-- CONSOLIDATED STEP 2F
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. Only an owner may regenerate their own pharmacy invitation code.
--
-- RLS chooses the permitted row. The column grant independently prevents the
-- browser from altering id, name, created_at, or any future sensitive column.
-- -----------------------------------------------------------------------------
drop policy if exists pharmacies_update_own on public.pharmacies;

create policy pharmacies_owner_update_code
on public.pharmacies
for update
to authenticated
using (
  id = private.my_pharmacy_id()
  and exists (
    select 1
    from public.profiles caller
    where caller.id = (select auth.uid())
      and caller.pharmacy_id = public.pharmacies.id
      and caller.role = 'owner'
  )
)
with check (
  id = private.my_pharmacy_id()
  and exists (
    select 1
    from public.profiles caller
    where caller.id = (select auth.uid())
      and caller.pharmacy_id = public.pharmacies.id
      and caller.role = 'owner'
  )
);

revoke update on table public.pharmacies from authenticated;
revoke update (id, name, code, created_at)
on table public.pharmacies
from authenticated;
grant update (code) on table public.pharmacies to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Remove anonymous access and explicitly grant only what the browser uses.
--
-- RLS remains enabled on every table and still controls which pharmacy rows an
-- authenticated user may access.
-- -----------------------------------------------------------------------------
revoke all on table
  public.catalog,
  public.configurations,
  public.flagged_products,
  public.generics_purchases,
  public.pharmacies,
  public.profiles
from public, anon, authenticated;

grant select, insert, update, delete on table public.catalog to authenticated;
grant select, insert, update on table public.configurations to authenticated;
grant select, insert, update, delete on table public.flagged_products to authenticated;
grant select, insert, update on table public.generics_purchases to authenticated;
grant select on table public.pharmacies to authenticated;
grant update (code) on table public.pharmacies to authenticated;
grant select on table public.profiles to authenticated;
grant update (initials) on table public.profiles to authenticated;

revoke all on sequence public.catalog_id_seq from public, anon, authenticated;
grant usage, select on sequence public.catalog_id_seq to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Harden legacy/helper functions.
--
-- The application does not call get_user_pharmacy_id(). Keep it temporarily to
-- avoid a destructive drop, but remove all Data API execution rights.
-- generate_unique_pharmacy_code() is used internally as the pharmacies.code
-- default and does not need to be a browser-callable RPC.
-- -----------------------------------------------------------------------------
create or replace function public.get_user_pharmacy_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pharmacy_id
  from public.profiles
  where id = (select auth.uid())
$$;

revoke all on function public.get_user_pharmacy_id()
from public, anon, authenticated;

create or replace function public.generate_unique_pharmacy_code()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result text;
begin
  loop
    result := 'PH-';
    for i in 1..4 loop
      result := result || substr(
        chars,
        floor(random() * length(chars) + 1)::integer,
        1
      );
    end loop;

    exit when not exists (
      select 1
      from public.pharmacies
      where code = result
    );
  end loop;

  return result;
end;
$$;

revoke all on function public.generate_unique_pharmacy_code()
from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- POST-MIGRATION STRUCTURAL VERIFICATION
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing_rls integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = 'c37f945e-2c4d-4449-9268-d7e8848e7237'::uuid
      and pharmacy_id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
      and role = 'owner'
  ) then
    raise exception
      'POSTCHECK FAILED: protected PJC 28 owner relationship changed';
  end if;

  select count(*)
  into v_missing_rls
  from (
    values
      ('catalog'),
      ('configurations'),
      ('flagged_products'),
      ('generics_purchases'),
      ('pharmacies'),
      ('profiles')
  ) as expected(table_name)
  where not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = expected.table_name
      and c.relrowsecurity
  );

  if v_missing_rls <> 0 then
    raise exception 'POSTCHECK FAILED: one or more public tables do not have RLS';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'catalog',
        'configurations',
        'flagged_products',
        'generics_purchases',
        'pharmacies',
        'profiles'
      )
      and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception
      'POSTCHECK FAILED: anonymous/public application table grants remain';
  end if;

  if exists (
    select 1
    from pharmaops_security_pre_counts before_counts
    join (
      select 'catalog'::text as table_name, count(*)::bigint as row_count from public.catalog
      union all
      select 'configurations', count(*) from public.configurations
      union all
      select 'flagged_products', count(*) from public.flagged_products
      union all
      select 'generics_purchases', count(*) from public.generics_purchases
      union all
      select 'pharmacies', count(*) from public.pharmacies
      union all
      select 'profiles', count(*) from public.profiles
    ) after_counts using (table_name)
    where before_counts.row_count <> after_counts.row_count
  ) then
    raise exception
      'POSTCHECK FAILED: an application table row count changed';
  end if;
end;
$$;

-- =============================================================================
-- BEGIN EMERGENCY ROLLBACK REHEARSAL
-- =============================================================================
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- -----------------------------------------------------------------------------
-- PRE-ROLLBACK IDENTITY AND MIGRATION-STATE GUARDS
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from public.pharmacies
    where id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
      and trim(name) = 'PJC 28'
  ) then
    raise exception
      'SAFETY STOP: protected production pharmacy PJC 28 was not found';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = 'c37f945e-2c4d-4449-9268-d7e8848e7237'::uuid
      and pharmacy_id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
      and role = 'owner'
  ) then
    raise exception
      'SAFETY STOP: protected PJC 28 owner relationship does not match baseline';
  end if;

  if to_regprocedure(
    'public.create_pharmacy_for_current_user(text,text)'
  ) is null
  or to_regprocedure(
    'public.join_pharmacy_for_current_user(text,text)'
  ) is null
  or to_regprocedure(
    'public.set_pharmacy_member_role(uuid,text)'
  ) is null
  or to_regprocedure(
    'public.remove_pharmacy_member(uuid)'
  ) is null
  or to_regprocedure(
    'private.my_pharmacy_id()'
  ) is null
  or to_regprocedure(
    'private.is_pharmacy_owner(uuid)'
  ) is null then
    raise exception
      'SAFETY STOP: expected committed security migration functions are missing';
  end if;
end;
$$;

create temporary table pharmaops_rollback_pre_counts
on commit drop
as
select 'catalog'::text as table_name, count(*)::bigint as row_count from public.catalog
union all
select 'configurations', count(*) from public.configurations
union all
select 'flagged_products', count(*) from public.flagged_products
union all
select 'generics_purchases', count(*) from public.generics_purchases
union all
select 'pharmacies', count(*) from public.pharmacies
union all
select 'profiles', count(*) from public.profiles;

-- =============================================================================
-- 1. RESTORE PRE-MIGRATION AUTH PROFILE CREATION
-- =============================================================================
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
    case
      when (new.raw_user_meta_data ->> 'pharmacy_id') ~ '^[0-9a-fA-F-]{36}$'
      then (new.raw_user_meta_data ->> 'pharmacy_id')::uuid
      else null
    end,
    coalesce(new.raw_user_meta_data ->> 'initials', 'N/A'),
    coalesce(new.raw_user_meta_data ->> 'role', 'tech')
  )
  on conflict (id) do update
  set pharmacy_id = excluded.pharmacy_id,
      initials = excluded.initials,
      email = excluded.email,
      role = coalesce(public.profiles.role, excluded.role);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- =============================================================================
-- 2. REMOVE MIGRATION-ONLY CONTROLLED RPC FUNCTIONS
-- =============================================================================
revoke all on function public.create_pharmacy_for_current_user(text, text)
from public, anon, authenticated;
revoke all on function public.join_pharmacy_for_current_user(text, text)
from public, anon, authenticated;
revoke all on function public.set_pharmacy_member_role(uuid, text)
from public, anon, authenticated;
revoke all on function public.remove_pharmacy_member(uuid)
from public, anon, authenticated;

drop function public.create_pharmacy_for_current_user(text, text);
drop function public.join_pharmacy_for_current_user(text, text);
drop function public.set_pharmacy_member_role(uuid, text);
drop function public.remove_pharmacy_member(uuid);

-- =============================================================================
-- 3. RESTORE THE PRE-MIGRATION PHARMACY LOOKUP FUNCTIONS
-- =============================================================================
create or replace function public.my_pharmacy_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pharmacy_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.get_user_pharmacy_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pharmacy_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.generate_unique_pharmacy_code()
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result text;
begin
  loop
    result := 'PH-';
    for i in 1..4 loop
      result := result || substr(
        chars,
        floor(random() * length(chars) + 1)::integer,
        1
      );
    end loop;

    exit when not exists (
      select 1
      from public.pharmacies
      where code = result
    );
  end loop;

  return result;
end;
$$;

revoke all on function public.my_pharmacy_id()
from public, anon, authenticated;
revoke all on function public.get_user_pharmacy_id()
from public, anon, authenticated;
revoke all on function public.generate_unique_pharmacy_code()
from public, anon, authenticated;

grant execute on function public.my_pharmacy_id()
to authenticated;
grant execute on function public.get_user_pharmacy_id()
to authenticated;
grant execute on function public.generate_unique_pharmacy_code()
to anon, authenticated;

-- =============================================================================
-- 4. RESTORE PRE-MIGRATION RLS POLICIES
-- =============================================================================
drop policy if exists profiles_update_own_safe on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_owner_delete on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;
drop policy if exists profiles_select_same_pharmacy on public.profiles;

create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_owner_delete
on public.profiles for delete to authenticated
using (
  pharmacy_id = public.my_pharmacy_id()
  and exists (
    select 1
    from public.profiles owner_profile
    where owner_profile.id = auth.uid()
      and owner_profile.role = any (array['owner'::text, 'admin'::text])
  )
);

create policy profiles_owner_update
on public.profiles for update to authenticated
using (
  pharmacy_id = public.my_pharmacy_id()
  and exists (
    select 1
    from public.profiles owner_profile
    where owner_profile.id = auth.uid()
      and owner_profile.role = any (array['owner'::text, 'admin'::text])
  )
);

create policy profiles_select_same_pharmacy
on public.profiles for select to authenticated
using (pharmacy_id = public.my_pharmacy_id());

drop policy if exists catalog_delete_own_pharmacy on public.catalog;
drop policy if exists catalog_update_own_pharmacy on public.catalog;
drop policy if exists catalog_write_own_pharmacy on public.catalog;
drop policy if exists catalog_select_own_or_master on public.catalog;

create policy catalog_delete_own_pharmacy
on public.catalog for delete to authenticated
using (pharmacy_id = public.my_pharmacy_id());

create policy catalog_update_own_pharmacy
on public.catalog for update to authenticated
using (pharmacy_id = public.my_pharmacy_id())
with check (pharmacy_id = public.my_pharmacy_id());

create policy catalog_write_own_pharmacy
on public.catalog for insert to authenticated
with check (pharmacy_id = public.my_pharmacy_id());

create policy catalog_select_own_or_master
on public.catalog for select to authenticated
using (
  pharmacy_id = public.my_pharmacy_id()
  or pharmacy_id = (
    select id
    from public.pharmacies
    where name ilike '%PJC 28%'
    limit 1
  )
);

drop policy if exists configurations_own_pharmacy on public.configurations;
create policy configurations_own_pharmacy
on public.configurations to authenticated
using (pharmacy_id = public.my_pharmacy_id())
with check (pharmacy_id = public.my_pharmacy_id());

drop policy if exists flagged_products_own_pharmacy on public.flagged_products;
create policy flagged_products_own_pharmacy
on public.flagged_products to authenticated
using (pharmacy_id = public.my_pharmacy_id())
with check (pharmacy_id = public.my_pharmacy_id());

drop policy if exists pharmacies_select_own on public.pharmacies;
drop policy if exists pharmacies_owner_update_code on public.pharmacies;
drop policy if exists pharmacies_select_public on public.pharmacies;
drop policy if exists pharmacies_insert_authenticated on public.pharmacies;
drop policy if exists "Permettre l'insertion à l'inscription" on public.pharmacies;
drop policy if exists pharmacies_update_own on public.pharmacies;

create policy "Permettre l'insertion à l'inscription"
on public.pharmacies for insert to authenticated, anon
with check (true);

create policy pharmacies_insert_authenticated
on public.pharmacies for insert to authenticated
with check (true);

create policy pharmacies_select_public
on public.pharmacies for select to authenticated, anon
using (true);

create policy pharmacies_update_own
on public.pharmacies for update to authenticated
using (id = public.my_pharmacy_id())
with check (id = public.my_pharmacy_id());

do $$
declare
  v_policy record;
begin
  for v_policy in
    select polname
    from pg_catalog.pg_policy
    where polrelid = 'public.generics_purchases'::regclass
  loop
    execute format(
      'drop policy %I on public.generics_purchases',
      v_policy.polname
    );
  end loop;
end;
$$;

create policy "Seul le propriétaire peut lire les achats génériques"
on public.generics_purchases for select to authenticated
using (auth.uid() is not null);

create policy "Seul le propriétaire peut écrire les achats génériques"
on public.generics_purchases to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- =============================================================================
-- 5. RESTORE THE PRE-MIGRATION DATA API PRIVILEGES NEEDED BY OLD MAIN
-- =============================================================================
revoke all on table
  public.catalog,
  public.configurations,
  public.flagged_products,
  public.generics_purchases,
  public.pharmacies,
  public.profiles
from public, anon, authenticated;

grant select, insert, update, delete on table public.catalog to authenticated;
grant select, insert, update, delete on table public.configurations to authenticated;
grant select, insert, update, delete on table public.flagged_products to authenticated;
grant select, insert, update, delete on table public.generics_purchases to authenticated;
grant select, insert, update on table public.pharmacies to authenticated;
grant select, insert on table public.pharmacies to anon;
grant select, insert, update, delete on table public.profiles to authenticated;

revoke all on sequence public.catalog_id_seq from public, anon, authenticated;
grant usage, select on sequence public.catalog_id_seq to authenticated;

-- =============================================================================
-- 6. REMOVE MIGRATION-ONLY PRIVATE HELPERS WITHOUT CASCADE
-- =============================================================================
revoke all on function private.is_pharmacy_owner(uuid)
from public, anon, authenticated;
revoke all on function private.my_pharmacy_id()
from public, anon, authenticated;

drop function private.is_pharmacy_owner(uuid);
drop function private.my_pharmacy_id();

-- This intentionally has no CASCADE. Any unexpected object makes the entire
-- transaction fail instead of deleting an object that this rollback did not
-- create.
drop schema private;

-- =============================================================================
-- 7. POST-ROLLBACK STRUCTURAL AND DATA-INTEGRITY CHECKS
-- =============================================================================
do $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = 'c37f945e-2c4d-4449-9268-d7e8848e7237'::uuid
      and pharmacy_id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
      and role = 'owner'
  ) then
    raise exception
      'POSTCHECK FAILED: protected PJC 28 owner relationship changed';
  end if;

  if exists (
    select 1
    from pharmaops_rollback_pre_counts before_counts
    join (
      select 'catalog'::text as table_name, count(*)::bigint as row_count from public.catalog
      union all
      select 'configurations', count(*) from public.configurations
      union all
      select 'flagged_products', count(*) from public.flagged_products
      union all
      select 'generics_purchases', count(*) from public.generics_purchases
      union all
      select 'pharmacies', count(*) from public.pharmacies
      union all
      select 'profiles', count(*) from public.profiles
    ) after_counts using (table_name)
    where before_counts.row_count <> after_counts.row_count
  ) then
    raise exception
      'POSTCHECK FAILED: an application table row count changed';
  end if;

  if to_regprocedure(
    'public.create_pharmacy_for_current_user(text,text)'
  ) is not null
  or to_regprocedure(
    'public.join_pharmacy_for_current_user(text,text)'
  ) is not null
  or to_regprocedure(
    'public.set_pharmacy_member_role(uuid,text)'
  ) is not null
  or to_regprocedure(
    'public.remove_pharmacy_member(uuid)'
  ) is not null then
    raise exception
      'POSTCHECK FAILED: one or more migration-only RPC functions remain';
  end if;

  if to_regnamespace('private') is not null then
    raise exception
      'POSTCHECK FAILED: migration-only private schema remains';
  end if;
end;
$$;

do $$
begin
  raise notice
    'PASS: migration and production rollback completed; final ROLLBACK follows';
end;
$$;

rollback;

-- The SQL Editor must report PASS and ROLLBACK. Afterward, recheck the protected
-- owner, application row counts, functions, policies, grants, and private schema.
