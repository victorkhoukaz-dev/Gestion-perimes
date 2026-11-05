# Company Returns cloud saving

Database migration `20261105042730_company_return_documents` was applied on November 4, 2026 (local time). Its recorded SQL is `supabase/migrations/20261105042730_company_return_documents.sql`. After deployment, authenticated access and isolation were checked again with synthetic rows, all rolled back. The original proposal remains as review history and must not be executed again.

## Behavior

- Opening Returns loads the signed-in pharmacy's report collection.
- Typing, scanning, adding/removing lines and creating/deleting reports update a local recovery copy. Press **Save draft** to save the collection online, including deletions. The badge distinguishes recovery-only changes from a successful online save.
- **Reload online** loads newer changes from another device. Unsaved recovery is archived locally after confirmation before replacing the working draft. **Download recovery** exports a separate JSON copy.
- **Copy old browser reports** copies the legacy device reports into the working collection; the user then presses Save draft. The legacy storage key is preserved. A fingerprint avoids copying the same unchanged legacy collection twice into the same online collection.
- Cloud recovery is scoped to the pharmacy and signed-in user, separately from the legacy browser reports. Do not clear browser storage while relying on recovery or archived drafts.
- One versioned document holds the pharmacy's collection. Two devices can read it, but a stale writer must reload instead of overwriting a newer save, even when edits concern different reports. This first version does not merge edits or provide live refresh.
- Loading online requires a connection. Failed saves preserve local recovery; no offline synchronization is promised. No service-role key is used in the browser.

## Deployment and acceptance checklist

1. Database migration applied and recorded. Do not rerun it or older migrations.
2. Check the new table's RLS, grants, revision trigger and authenticated Data API access. Do not publish the client before the table exists.
3. Commit and publish the main client changes. Main cache version advances from v51 to v52.
4. Sign in on two devices to the same pharmacy. Create and save a draft on one; open it on the other. Edit and save, then reload on the first. Test stale-save rejection with both devices editing the same original revision.
5. Transfer existing local reports on each original device with Copy old browser reports, review the result, then Save draft. Originals remain local.
6. After acceptance, bring the changes into integration using its next cache version.

## Validation completed

- Inline JavaScript syntax and standalone modules checked.
- 16 existing scanner, catalogue, navigation, persistence and service worker checks passed.
- Four cloud storage tests cover cross-device reload, competing first saves, stale revisions, failed saves, edits during a save and local-tab recovery conflicts.
- One UI flow test covers explicit legacy transfer, preservation of the original browser records, duplicate-transfer protection, online save, saving an empty collection after report deletion, and creating a report afterwards.
- `scratch/returns-cloud-rehearsal.sql`, appended to the proposed migration with COMMIT removed, tested real authenticated own-pharmacy insert/read/update, blocked cross-pharmacy insert/update, stale-update rejection, blocked table deletion and blocked anonymous reads. All schema and synthetic records were rolled back.

Live phone acceptance testing is pending the user's test after publication. Cost and manufacturer work is outside this change.
