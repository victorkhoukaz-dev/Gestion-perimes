# Supabase database artifacts

This folder preserves the reviewed PharmaOps database history. Production SQL must be treated as an auditable migration, not as a script to rerun casually.

## Folder guide

- `migrations/`: migrations that were executed in Supabase production.
- `rollback/`: emergency rollback material. Files marked `review_required` contain a deliberate safety stop and must be reviewed before any execution copy is prepared.
- `audit/`: read-only inspection queries.
- `archive/rehearsals/`: rollback-only migration and disposable-account rehearsal scripts retained for evidence.
- `archive/legacy/`: superseded setup and cleanup scripts retained for history only.

## Current production migration

- Supabase migration history: `20260806010853_pharmaops_security_2a_2f`
- Repository file: `migrations/20260806010853_pharmaops_security_2a_2f.sql`
- Deployment record: `../docs/supabase/security_migration_2026-08-05_runbook.md`

Do not execute the production migration again. Future schema changes should be prepared as new, timestamped migrations and tested independently.

## Accepted and deferred advisor notices

- Accepted: the four authenticated `SECURITY DEFINER` RPC warnings are intentional, narrow user operations. Anonymous/public execution is revoked and the complete onboarding/isolation test passed.
- Deferred: leaked-password protection should be enabled before commercial onboarding when the project uses a Supabase plan that supports it.
- Deferred: profile-policy and index performance suggestions should be reconsidered during the shared master-catalog redesign.

## Data safety

The repository contains schema and migration logic, not database passwords or logical backup archives. Logical backups are stored separately under `C:\Users\victo\Documents\PharmaOps_Backups`.
