# PharmaOps Supabase production deployment runbook

Status: prepared and rollback-rehearsed; not yet approved for production execution.

This runbook coordinates the Supabase security migration with the matching application deployment. Do not merge or run the production migration until the deployment-day preflight is complete.

## Release artifacts

- Application branch: `hotfix/supabase-security`
- Draft pull request: `#2`
- Hotfix base commit from `main`: `ac833fd`
- Initial hotfix commit: `bdfacda`
- Production migration: `supabase_security_migration_PRODUCTION_CANDIDATE.sql`
- Emergency rollback: `supabase_security_PRODUCTION_ROLLBACK_DRAFT.sql`
- Rehearsal: `supabase_security_PRODUCTION_ROLLBACK_REHEARSAL.sql`

The production migration and updated `App/index.html` must be deployed together. Never merge `integration` as part of this release.

## Known protected baseline from the completed rehearsal

| Check | Expected value |
| --- | ---: |
| `catalog` rows | 20,685 |
| `configurations` rows | 2 |
| `flagged_products` rows | 150 |
| `generics_purchases` rows | 4 |
| `pharmacies` rows | 2 |
| `profiles` rows | 2 |
| Protected owner relationship | 1 match |
| Migration-only RPC functions | 0 before deployment |
| `private` schema | absent before deployment |

These counts are historical reference values, not deployment-day acceptance values. Record fresh counts immediately before deployment and require the post-deployment counts to match those fresh values.

Protected pharmacy:

- Pharmacy ID: `1602e82f-5ee5-4255-ace8-a7644ad3db40`
- Expected name: `PJC 28`
- Owner profile ID: `c37f945e-2c4d-4449-9268-d7e8848e7237`
- Expected role: `owner`

## Phase 3: deployment-day preflight

### 1. Choose the deployment window

- Pause normal inventory edits.
- Confirm no employee is currently changing expiry or generic-purchase data.
- Keep the previous `main` application build available at commit `ac833fd`.

### 2. Verify owner access

- Log in with the existing owner account.
- Confirm PJC 28 loads.
- Confirm expiry inventory and generic dashboards display existing data.
- Do not proceed if login or current data loading is already failing.

### 3. Record fresh database baseline

Run this read-only query in Supabase SQL Editor and save the results with the deployment notes:

```sql
select 'catalog' as item, count(*)::bigint as value from public.catalog
union all select 'configurations', count(*) from public.configurations
union all select 'flagged_products', count(*) from public.flagged_products
union all select 'generics_purchases', count(*) from public.generics_purchases
union all select 'pharmacies', count(*) from public.pharmacies
union all select 'profiles', count(*) from public.profiles
union all select 'protected_owner_matches', count(*) from public.profiles
where id = 'c37f945e-2c4d-4449-9268-d7e8848e7237'::uuid
  and pharmacy_id = '1602e82f-5ee5-4255-ace8-a7644ad3db40'::uuid
  and role = 'owner'
union all select 'private_schema_exists', count(*) from pg_namespace
where nspname = 'private'
order by item;
```

Required before continuing:

- `protected_owner_matches = 1`
- `private_schema_exists = 0`
- Every application-table count recorded successfully

### 4. Create a fresh logical backup

Use the connection parameters shown by Supabase Dashboard **Connect**. Do not put the database password in this repository or in the command history. Let `pg_dump` prompt for it.

```powershell
$backupStamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$backupDir = "C:\Users\victo\Documents\PharmaOps_Backups\$backupStamp"
New-Item -ItemType Directory -Path $backupDir

$pgDump = 'C:\Users\victo\AppData\Local\PharmaOpsTools\postgresql-17.10\pgsql\bin\pg_dump.exe'

& $pgDump --host '<HOST FROM SUPABASE CONNECT>' --port '<PORT>' --username '<USER>' --dbname 'postgres' --password --format=custom --no-owner --file "$backupDir\full_database.dump"

& $pgDump --host '<HOST FROM SUPABASE CONNECT>' --port '<PORT>' --username '<USER>' --dbname 'postgres' --password --schema=public --schema-only --no-owner --file "$backupDir\public_schema.sql"

& $pgDump --host '<HOST FROM SUPABASE CONNECT>' --port '<PORT>' --username '<USER>' --dbname 'postgres' --password --schema=public --data-only --format=custom --no-owner --file "$backupDir\public_data.dump"
```

Verify all three files exist and are larger than zero bytes:

```powershell
Get-ChildItem -LiteralPath $backupDir | Select-Object Name, Length, LastWriteTime
```

Keep the verified August 4 backup unchanged as a second recovery point.

### 5. Final go/no-go

Proceed only when:

- Owner access works.
- Fresh counts are recorded.
- Fresh backup files are non-empty.
- PR `#2` contains only the intended hotfix.
- The production migration file matches the reviewed commit.
- The person deploying has enough uninterrupted time to complete smoke tests.

## Phase 4: coordinated migration and application deployment

### 1. Run the database migration

Open `supabase_security_migration_PRODUCTION_CANDIDATE.sql` in Supabase SQL Editor, verify the target is **Périmés labo / main / Production**, and run the complete file once.

Expected result: successful transaction commit with no failed safeguard.

If it errors, stop. PostgreSQL will roll back the transaction. Do not retry until the exact error has been reviewed.

### 2. Immediately deploy the matching application

- Merge only PR `#2` into `main`.
- Confirm `integration` is not part of the merge.
- Wait for the normal `main` deployment to finish.
- Record the deployed commit ID.

Do not run the migration a second time after a successful commit.

## Phase 5: immediate smoke tests

### Existing owner account

- [ ] Login succeeds.
- [ ] PJC 28 loads.
- [ ] Expiry inventory rows display.
- [ ] Catalog search works.
- [ ] Saving and reloading an expiry change works.
- [ ] Monthly generic dashboard loads and reloads.
- [ ] Annual generic dashboard loads and reloads.
- [ ] Team members display.
- [ ] Invitation code and invitation link display.

### Disposable account

- [ ] Signup creates a neutral profile.
- [ ] Create-pharmacy flow works.
- [ ] Join-by-code flow works.
- [ ] Technician cannot read another pharmacy's private rows.
- [ ] Technician cannot change security fields directly.
- [ ] Owner can change another member's role through the protected RPC.
- [ ] Removing access preserves the Auth account.

### Independent database postflight

- [ ] Re-run the Phase 3 baseline query.
- [ ] Every application-table count matches the fresh pre-deployment count, except explicitly created disposable test records.
- [ ] Protected owner relationship still returns exactly one match.
- [ ] `private` schema exists.
- [ ] All four protected RPC functions exist.
- [ ] No anonymous/public application-table grants remain.

## Emergency decision

### Migration fails before commit

- Stop immediately.
- Do not deploy the updated application.
- Confirm the old application still works.
- Preserve the SQL error for review.

### Migration commits but application deployment fails

- First attempt to complete or repair the application deployment.
- If that cannot be done promptly, prepare an execution copy of `supabase_security_PRODUCTION_ROLLBACK_DRAFT.sql` by removing only its deliberate `DRAFT ONLY` stop.
- Review that execution copy before running it.
- Run the emergency rollback once.
- Redeploy previous `main` commit `ac833fd`.
- Re-run owner, policy, and row-count checks.

### Data or ownership check fails

- Stop user activity.
- Do not perform additional writes.
- Preserve logs and current database state.
- Prefer targeted diagnosis before attempting a full database restore.
- Use the fresh logical backup only after confirming the exact restore scope.

## Completion record

Record these values during deployment:

- Deployment date and start time:
- Operator:
- Fresh backup folder:
- Pre-deployment counts:
- Migration result:
- Merged PR and commit:
- Application deployment result:
- Post-deployment counts:
- Owner smoke-test result:
- Disposable-account test result:
- Final go-live decision:
