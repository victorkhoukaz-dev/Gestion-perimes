# Agent instructions — PharmaOps

Read these instructions before changing the project.

## Language

- The published website and its user-facing features must be in French, using Canadian French conventions where appropriate. This includes navigation, buttons, loading states, errors, confirmations, accessibility labels, printed reports and documents generated for app users.
- Agent conversations, plans, explanations, source-code comments, configuration comments, README files, internal Markdown documents and other development/construction files must be in English.
- Preserve technical identifiers, storage keys, database values, medication names and imported/user-entered data when translating UI text. Do not add an English UI or a language selector unless requested.

## Collaboration and authorization

- The user is learning programming. Work in small, testable steps; explain major architectural choices in plain language before implementing them.
- After each step, explain what changed, how to test it and what to learn from it.
- Do not delete data, publish, or spend money without authorization. Authorization already given for the current action remains valid.
- Check the branch and working tree before Git operations. Do not publish integration features prematurely. Follow the user's current merge and release instructions.

## Architecture and data protection

- PharmaOps is a PWA in `App/`, built with HTML, vanilla JavaScript and CSS, with Supabase and pharmacy isolation through `pharmacy_id` and Row Level Security.
- Keep the lightweight architecture. Do not add a heavy bundler or framework without an explicit request; avoid unnecessary dependencies.
- Follow `supabase/README.md` and versioned migrations in `supabase/migrations/`. Record schema changes as new migrations; never rerun a historical production migration.
- Never expose secret or service-role keys in browser code.
- Preserve existing reports, recovery copies and UPC/DIN associations. Keep exports and backups out of Git tracking and deployment; Git ignore rules do not remove historical commits.
- Preserve the entry workflow: UPC or 2D scan fills the product and available lot/expiry, immediately focuses Quantity, then Enter saves and returns to barcode entry. Support multiple UPCs per DIN.

## Required validation

A syntax error in an inline script in `App/index.html` can disable all listeners and block login. After editing it and before committing, run:

```powershell
node -e "const fs = require('fs'); const html = fs.readFileSync('./App/index.html', 'utf8'); const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []; scripts.forEach(s => { const code = s.replace(/<\/?script[^>]*>/gi, ''); new Function(code); }); console.log('JavaScript syntax OK');"
```

- Check changed JavaScript modules and run relevant tests.
- Any static HTML, CSS or JavaScript change under `App/` requires incrementing `CACHE_NAME` in `App/sw.js`, so mobile and desktop devices receive updates.
- When translating UI, check confirmations, errors, unit lists, printing and compatibility with saved reports.

## Local development

- Start the local server with `powershell ./serve.ps1` or `lancer_local.bat`; inspect the script for the configured port.
- For local mobile access, use `powershell ./lancer_mobile.ps1`.
- Main UI and inline logic: `App/index.html`; PWA cache: `App/sw.js`; database artifacts: `supabase/`; developer tests: `scratch/`.
