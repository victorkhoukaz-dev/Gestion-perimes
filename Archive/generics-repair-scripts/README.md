# Archived generics repair scripts

These 49 historical scripts were moved from `App/scratch/` during preparation for merging `integration` into `main`. Their contents are unchanged. No references from the active application were found; the dashboards do not require them.

**Do not run them against the current application.** Many rewrite HTML files and reference absolute paths or obsolete app versions. They are retained for historical reference, not maintained repair tools.

Current tests remain in the repository-level `scratch/` directory:

```powershell
node scratch/check_generics_name_review.cjs
node --test scratch/test_generics_session.cjs scratch/test_generics_name_review.cjs
python scratch/test_generics_session_browser.py
```

The browser test uses installed Chrome with synthetic accounts and stubbed services. It does not connect to the production database.

GitHub Pages currently publishes the root of `main`. The cleanup's `_config.yml` excludes this archive and other internal directories from the next authorized build while preserving `/App/` URLs. Verify the deployed exclusions after publication. They do not make files private in a public Git repository or its history.
