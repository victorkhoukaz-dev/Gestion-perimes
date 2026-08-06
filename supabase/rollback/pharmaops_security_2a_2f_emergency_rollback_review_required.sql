-- =============================================================================
-- PHARMAOPS - PRODUCTION SECURITY MIGRATION ROLLBACK (REVIEW DRAFT ONLY)
-- =============================================================================
-- STATUS: DO NOT RUN YET.
--
-- Purpose:
--   Restore the pre-security-migration application contract after the
--   consolidated migration has already committed. This script changes only
--   functions, policies, grants, and the migration-created private helpers.
--   It does not intentionally insert, update, or delete application rows.
--
-- WARNING:
--   This rollback deliberately restores the older, less restrictive access
--   model so the previous main application can function. Use it only as an
--   emergency rollback together with redeployment of the previous main build.
--
-- SAFETY:
--   1. Keep the DRAFT ONLY stop until the rollback rehearsal passes.
--   2. Take a fresh pg_dump and record protected row counts before use.
--   3. Run during a quiet period with normal user activity paused.
-- =============================================================================

begin;

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

-- Deliberate stop. Remove only in the separately reviewed production copy.
do $$
begin
  raise exception
    'DRAFT ONLY: production rollback rehearsal and final approval are required';
end;
$$;

-- Everything below is unreachable until the single safety stop is removed.

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

commit;

-- =============================================================================
-- REQUIRED ACTIONS AFTER AN EMERGENCY ROLLBACK
-- =============================================================================
-- 1. Redeploy the previous main application build.
-- 2. Verify PJC 28 owner identity and every protected table row count.
-- 3. Test login, existing pharmacy loading, inventory save/reload, invitations,
--    team management, and generic dashboards.
-- 4. Confirm that no disposable account or test pharmacy remains.
-- 5. Preserve logs and do not retry the failed migration until reviewed.
-- =============================================================================
