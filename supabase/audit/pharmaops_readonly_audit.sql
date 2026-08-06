-- PharmaOps / Supabase metadata security audit
-- READ ONLY: this script inspects database catalogs and never reads application rows.
-- Run the complete script in the Supabase SQL Editor, then download each result set.

begin transaction read only;

-- 1. Database environment (the hosting region must be confirmed in the dashboard).
select
  current_database() as database_name,
  current_user as executing_role,
  current_setting('server_version') as postgres_version,
  now() as audited_at;

-- 2. Tables, views, owners, and RLS state in application-facing schemas.
select
  n.nspname as schema_name,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'f' then 'foreign table'
    else c.relkind::text
  end as object_type,
  pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
order by n.nspname, c.relname;

-- 3. Column definitions only (no row values).
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  is_identity,
  is_generated
from information_schema.columns
where table_schema in ('public', 'storage')
order by table_schema, table_name, ordinal_position;

-- 4. Primary keys, foreign keys, unique constraints, and checks.
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'p' then 'primary key'
    when 'f' then 'foreign key'
    when 'u' then 'unique'
    when 'c' then 'check'
    when 'x' then 'exclusion'
    else con.contype::text
  end as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
order by n.nspname, c.relname, con.conname;

-- 5. Every active RLS policy.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 6. Explicit table grants relevant to the Data API.
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by table_schema, table_name, grantee, privilege_type;

-- 7. Functions, privilege mode, arguments, and execution grants.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  coalesce(array_to_string(p.proacl, E'\n'), 'default privileges') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

select
  routine_schema,
  routine_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_routine_grants
where routine_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by routine_name, grantee;

-- 8. Function source is application code, not application data.
-- Review for raw_user_meta_data, dynamic SQL, secrets, and unsafe search_path usage.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

-- 9. Triggers and views.
select
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname in ('public', 'storage')
order by n.nspname, c.relname, t.tgname;

select
  schemaname,
  viewname,
  viewowner,
  definition
from pg_views
where schemaname in ('public', 'storage')
order by schemaname, viewname;

-- 10. Default privileges determine whether future objects are exposed automatically.
select
  pg_get_userbyid(d.defaclrole) as owner,
  n.nspname as schema_name,
  d.defaclobjtype as object_type,
  d.defaclacl as access_privileges
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname is null or n.nspname in ('public', 'storage')
order by owner, schema_name, object_type;

-- 11. Extensions can affect the attack surface and migration reproducibility.
select
  e.extname as extension_name,
  e.extversion as installed_version,
  n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;

-- 12. Automated security flags. Empty result sets are desirable.

-- 12a. Exposed application tables without RLS.
select
  n.nspname as schema_name,
  c.relname as table_name,
  'TABLE_WITHOUT_RLS' as finding
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
order by c.relname;

-- 12b. Policies that unconditionally allow rows.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  'UNCONDITIONAL_POLICY' as finding
from pg_policies
where schemaname in ('public', 'storage')
  and (
    lower(regexp_replace(coalesce(qual, ''), '[()[:space:]]', '', 'g')) = 'true'
    or lower(regexp_replace(coalesce(with_check, ''), '[()[:space:]]', '', 'g')) = 'true'
  )
order by schemaname, tablename, policyname;

-- 12c. UPDATE policies without an explicit WITH CHECK expression.
select
  schemaname,
  tablename,
  policyname,
  roles,
  qual,
  with_check,
  'UPDATE_WITHOUT_EXPLICIT_WITH_CHECK' as finding
from pg_policies
where schemaname in ('public', 'storage')
  and cmd in ('UPDATE', 'ALL')
  and with_check is null
order by schemaname, tablename, policyname;

-- 12d. SECURITY DEFINER functions executable by PUBLIC/anon/authenticated.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  r.grantee,
  'EXPOSED_SECURITY_DEFINER' as finding
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join information_schema.role_routine_grants r
  on r.routine_schema = n.nspname
 and r.routine_name = p.proname
where n.nspname = 'public'
  and p.prosecdef
  and r.grantee in ('PUBLIC', 'anon', 'authenticated')
order by p.proname, r.grantee;

-- 12e. Sensitive-looking columns on tables granted SELECT to anon.
select distinct
  c.table_schema,
  c.table_name,
  c.column_name,
  'SENSITIVE_COLUMN_ON_ANON_READABLE_TABLE' as finding
from information_schema.columns c
join information_schema.role_table_grants g
  on g.table_schema = c.table_schema
 and g.table_name = c.table_name
where c.table_schema in ('public', 'storage')
  and g.grantee = 'anon'
  and g.privilege_type = 'SELECT'
  and c.column_name ~* '(secret|token|password|api.?key|private.?key|credential)'
order by c.table_schema, c.table_name, c.column_name;

commit;

-- Dashboard-only checks not available through safe catalog SQL:
-- 1. Project region and organization ownership.
-- 2. Data API exposed schemas/settings.
-- 3. Auth providers, MFA, password rules, session/JWT lifetime, CAPTCHA, SMTP.
-- 4. Backups/PITR and restore readiness.
-- 5. Vault secrets, Edge Function secrets, logs, and organization access controls.
-- 6. Security Advisor and Performance Advisor results.
